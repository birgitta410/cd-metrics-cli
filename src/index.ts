import yargs from "yargs";

yargs
  .command('$0 [name]', 'say hello', (yargs) => {
    yargs
      .positional('name', {
        describe: 'hello\'s target',
        default: 'world'
      })
      .option('times', {
        alias: 't',
        type: 'number',
        default: 1,
        description: 'number of times to say hello'
      })
  }, (argv: any) => {
    for (let i = 0;i < argv.times; i++) {
      console.log(`Hello ${argv.name}!`)
    }
  })
  .argv