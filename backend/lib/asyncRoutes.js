// Express 4 不會捕捉 async handler 拋出的 rejection，請求會一直掛著直到 Vercel 逾時。
// 統一包裝所有路由，讓錯誤一律交給最後的全局錯誤處理中間件以 JSON 回應。
const wrapAsync = (fn) =>
  typeof fn === "function" && fn.length < 4
    ? function (req, res, next) {
        const ret = fn.call(this, req, res, next);
        if (ret && typeof ret.catch === "function") ret.catch(next);
        return ret;
      }
    : fn;

// 必須在註冊任何路由之前呼叫
export function patchAsyncRoutes(app) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const original = app[method].bind(app);
    // app.get(name) 只有一個參數時是讀取設定值，不能包裝
    app[method] = (path, ...handlers) =>
      handlers.length === 0
        ? original(path)
        : original(path, ...handlers.map(wrapAsync));
  }
  return app;
}
