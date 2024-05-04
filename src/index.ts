import { generatorHandler } from "@prisma/generator-helper";
import { generate } from "./generator";

// eslint-disable-next-line local-rules/no-global-function-call
generatorHandler({
  onManifest() {
    return {
      defaultOutput: "./it-runner",
      prettyName: "prisma-generator-it-runner",
    };
  },
  async onGenerate(options) {
    const output = options.generator.output;

    if (!output) {
      throw new Error("No output was specified for prisma-generator-it-runner");
    }

    try {
      await generate(output.value as string, options);
    } catch (e) {
      console.error("Error: unable to generate files for prisma-generator-it-runner");
      throw e;
    }
  },
});
