export function asyncTester(fn) {
  return async function (done) {
    try {
      await fn();
      done();
    } catch (e) {
      done(e);
    }
  };
}
