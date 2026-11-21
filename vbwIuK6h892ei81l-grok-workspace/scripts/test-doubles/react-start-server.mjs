export function getRequest() {
  return (
    globalThis.__nextstepTestRequest ?? {
      headers: {
        get() {
          return null;
        },
      },
    }
  );
}
