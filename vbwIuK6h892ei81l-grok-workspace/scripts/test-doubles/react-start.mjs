export function createServerFn() {
  const state = { validator: null };
  const api = {
    validator(fn) {
      state.validator = fn;
      return api;
    },
    inputValidator(fn) {
      state.validator = fn;
      return api;
    },
    middleware() {
      return api;
    },
    handler(fn) {
      return async (input) => {
        const raw = input && typeof input === "object" && "data" in input ? input.data : input;
        const data = state.validator ? await state.validator(raw) : raw;
        return fn({
          context: { userId: globalThis.__nextstepUserId ?? "" },
          data,
        });
      };
    },
  };
  return api;
}
