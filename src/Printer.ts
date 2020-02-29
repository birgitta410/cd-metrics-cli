import prompts = require("prompts");
import fs = require("fs");
import chalk = require("chalk");

const OUTPUT_FOLDER = "cd-metrics-cli-output";

export class Printer {
  public static async print(lines: string[]) {
    const listEventsUserPrompt = await prompts({
      type: "select",
      name: "value",
      message: "Print events?",
      choices: [
        { title: "Yes", value: "yes" },
        { title: "No", value: "no" },
        { title: "To file", value: "file" }
      ],
      max: 1,
      hint: "- Space to select. Return to submit"
    });

    if (listEventsUserPrompt.value === "yes") {
      lines.forEach(line => {
        console.log(`${line}`);
      });
    } else if (listEventsUserPrompt.value === "file") {
      const fileNamePrompt = await prompts({
        type: "text",
        name: "value",
        message: "File name? (will be written to ./outputs)"
      });
      const filePath = `./${OUTPUT_FOLDER}/${fileNamePrompt.value}`;
      console.log(`Writing output to file ${chalk.cyanBright(filePath)}`);
      fs.writeFileSync(`${filePath}`, lines.join("\n"));
    }
  }
}
