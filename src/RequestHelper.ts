export class RequestHelper {
  // inspired by https://dev.to/karataev/handling-a-lot-of-requests-in-javascript-with-promises-1kbb

  private static async executeAll(items: any[], fn: Function) {
    let result: any[] = [];
    return items
      .reduce((acc, item) => {
        acc = acc.then(() => {
          return fn(item).then((res: any) => result.push(res));
        });
        return acc;
      }, Promise.resolve())
      .then(() => result);
  }

  private static splitToChunks(items: any[], chunkSize = 50) {
    const result = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      result.push(items.slice(i, i + chunkSize));
    }
    return result;
  }

  private static async promiseAll(items: any[], fn: Function) {
    return Promise.all(items.map(item => fn(item)));
  }

  public static async executeInChunks(items: any[], fn: Function, chunkSize = 50) {
    let result: any[] = [];
    const chunks = this.splitToChunks(items, chunkSize);
    return this.executeAll(chunks, (chunk: any) => {
      return this.promiseAll(chunk, fn).then(res => (result = result.concat(res)));
    }).then(() => result);
  }
}
