import { GeneratorOptions } from "@prisma/generator-helper";
import * as fs from "fs";
import * as path from "path";

function renderTemplate(
	template: string,
	variables: { [name: string]: string },
): string {
	let out = template;
	Object.entries(variables).forEach(([name, value]) => {
		out = out.replace(new RegExp(`%\\(${name}\\)`, "g"), value);
	});
	return out;
}

function toLower(s: string): string {
	return s.charAt(0).toLowerCase() + s.slice(1);
}

function formatLines(lines: string[], indent: number): string {
	return lines.join("\n" + " ".repeat(indent));
}

interface Model {
	name: string;
	dbName: string | null;
	fields: {
		fieldName: string;
		fieldType: string;
		isRequired: boolean;
	}[];
	relations: ModelRelation[];
}

interface ModelRelation {
	to: Model;
	fromFields: readonly string[];
	toFields: readonly string[];
}

// Execute topological sort based on model relations
// Returns model groups, each of which contains models independent each other
// The top group has no dependency, the second group depends on top group, ...
function topologicalSort(models: Model[]): Model[][] {
	const modelMap: { [key: string]: Model } = {};
	const reverseEdges: { [key: string]: string[] } = {};
	const edgeCount: { [key: string]: number } = {};

	const queue: string[] = [];
	const ranks: { [key: string]: number } = {};

	models.forEach((model) => {
		modelMap[model.name] = model;
		reverseEdges[model.name] = [];
		edgeCount[model.name] = model.relations.length;

		if (edgeCount[model.name] == 0) queue.push(model.name);
		ranks[model.name] = 0;
	});

	models.forEach((model) => {
		model.relations.forEach((relation) => {
			reverseEdges[relation.to.name].push(model.name);
		});
	});

	// Assign orders starting from nodes without edges
	// ranks[from] = max(ranks[to] + 1), representing the fact that a node depends on all children
	// When all edges of a node are checked, the rank of the node is fixed and added to the queue
	// Repeat this cycle until there are no queued nodes
	const result: Model[][] = [];
	while (queue.length > 0) {
		const modelName = queue.shift() as string;

		const rank = ranks[modelName];
		if (result.length <= rank) result.push([]);
		result[rank].push(modelMap[modelName] as Model);

		reverseEdges[modelName].forEach((to) => {
			ranks[to] = rank + 1; // We can omit max() because ranks will strictly increase
			edgeCount[to] -= 1;
			if (edgeCount[to] == 0) queue.push(to);
		});
	}

	return result;
}

export async function generate(basePath: string, options: GeneratorOptions) {
	await fs.promises.mkdir(basePath, { recursive: true });

	const template = (
		await fs.promises.readFile(
			path.join(__dirname, "template", "engine.ts.template"),
		)
	).toString();

	const models = options.dmmf.datamodel.models.map(
		(model): Model => ({
			name: model.name,
			dbName: model.dbName ?? model.name,
			fields: model.fields.map((f) => {
				return {
					fieldName: f.name,
					fieldType: f.type,
					isRequired: f.isRequired,
				};
			}),
			relations: model.fields
				.map((field): ModelRelation[] =>
					// Please refer actual Prisma schema
					// Forward relation contains onDelete info
					field.relationOnDelete
						? [
								{
									to: { name: field.type } as Model, // Add dummy model, inserting actual values later
									fromFields: field.relationFromFields
										? field.relationFromFields
										: [],
									toFields: field.relationToFields
										? field.relationToFields
										: [],
								},
							]
						: [],
				)
				.flat(),
		}),
	);

	// Insert relation models
	models.forEach((model) => {
		model.relations.forEach((relation) => {
			relation.to = models.find((to) => to.name == relation.to.name) as Model;
		});
	});

	const modelImports = formatLines(
		models.map((model) => `${model.name},`),
		2,
	);

	const modelNames = formatLines(
		models.map((model) => `"${model.name}",`),
		2,
	);

	const recordSetFields = formatLines(
		models.map((model) => `${model.dbName}?: ${model.name}[];`),
		2,
	);

	const recordSetAssertionFields = formatLines(
		models.map((model) => `${model.dbName}?: Partial<${model.name}>[];`),
		2,
	);

	const recordSetAssertionSortKeyFields = formatLines(
		models.map((model) => `${model.dbName}?: (keyof ${model.name})[];`),
		2,
	);

	const autoIncrementResetFields = formatLines(
		models.map((model) => `${model.dbName}?: number;`),
		2,
	);

	const sortedModels = topologicalSort(models);

	const applyRecordSetDeleteJobs = formatLines(
		sortedModels
			.slice()
			.reverse()
			.map((models) =>
				// Execute jobs in the same group in parallel
				[`await Promise.all([`]
					.concat(
						models.map(
							(model) =>
								`  recordSet.${model.dbName} ? db.$executeRawUnsafe(\`DELETE FROM "${model.dbName}";\`) : Promise.resolve(),`,
						),
					)
					.concat([`]);`, ``]),
			)
			.flat(),
		2,
	);

	const applyRecordSetCreateJobs = formatLines(
		sortedModels
			.map((models) =>
				// Execute jobs in the same group in parallel
				[`await Promise.all([`]
					.concat(
						models.map((model) => {
							const jsonFields = model.fields.filter(
								(f) => f.fieldType === "Json",
							);
							let mapString = "";
							if (jsonFields.length > 0) {
								const jsonFieldsString = jsonFields
									.map(
										(jf) =>
											`${jf.fieldName}: ${
												jf.isRequired
													? ""
													: `r.${jf.fieldName} === undefined ? undefined : `
											}r.${jf.fieldName} === null ? Prisma.JsonNull : r.${
												jf.fieldName
											}`,
									)
									.join(", ");
								mapString = `.map(r => ({ ...r, ${jsonFieldsString}}))`;
							}
							return `  recordSet.${model.dbName} ? db.${toLower(
								model.name,
							)}.createMany({ data: recordSet.${
								model.dbName
							}${mapString} ?? [] }) : Promise.resolve(),`;
						}),
					)
					.concat([`]);`, ``]),
			)
			.flat(),
		2,
	);

	const applyRecordSetAutoIncrementResetJobs = formatLines(
		models.map(
			(model) =>
				`if(autoIncrementReset.${model.dbName}) autoIncrementResetJobs.push(db.$executeRawUnsafe(\`SELECT SETVAL ('${model.dbName}_id_seq', \${autoIncrementReset.${model.dbName}}, false);\`));`,
		),
		2,
	);

	const importRecordSetVars = formatLines(
		models.map((model) => `${model.dbName},`),
		4,
	);

	const importRecordSetJobs = formatLines(
		models.map((model) => `db.${toLower(model.name)}.findMany(),`),
		4,
	);

	const assertRecordSetAssertions = formatLines(
		models.map((model) => {
			return `if (recordSet.${model.dbName}) assertFunc(recordSet.${
				model.dbName
			}, await db.${toLower(model.name)}.findMany(), assertSortKey?.${
				model.dbName
			});`;
		}),
		2,
	);

	const seederFields = formatLines(
		models.map((model) => `${model.dbName}?: () => ${model.name};`),
		2,
	);

	const autoCompleteJobs = formatLines(
		sortedModels
			.slice()
			.reverse()
			.flat()
			.map((model): string[] =>
				model.relations.length > 0
					? [`recordSet.${model.dbName}?.forEach((${model.dbName}) => {`]
							.concat(
								model.relations.map((relation) => {
									const to = relation.to.dbName;
									return `  if (!original.${to} && ${model.dbName}.${relation.fromFields[0]} && !recordSet.${to}?.find((${to}) => ${to}.${relation.toFields[0]} == ${model.dbName}.${relation.fromFields[0]})) recordSet.${to} = (recordSet.${to} ?? []).concat(seeder.${to} ? [ { ...seeder.${to}(), ${relation.toFields[0]}: ${model.dbName}.${relation.fromFields[0]} } ] : (() => { throw Error("seeder for ${to} is not defined"); })());`;
								}),
							)
							.concat([`});`, ``])
					: [],
			)
			.flat(),
		2,
	);

	const out = renderTemplate(template, {
		modelImports,
		modelNames,
		recordSetFields,
		recordSetAssertionFields,
		recordSetAssertionSortKeyFields,
		autoIncrementResetFields,
		applyRecordSetDeleteJobs,
		applyRecordSetCreateJobs,
		applyRecordSetAutoIncrementResetJobs,
		importRecordSetVars,
		importRecordSetJobs,
		assertRecordSetAssertions,
		seederFields,
		autoCompleteJobs,
	});

	await fs.promises.writeFile(path.join(basePath, "engine.ts"), out);

	const runner = (
		await fs.promises.readFile(path.join(__dirname, "template", "runner.ts"))
	).toString();
	await fs.promises.writeFile(path.join(basePath, "runner.ts"), runner);
}
