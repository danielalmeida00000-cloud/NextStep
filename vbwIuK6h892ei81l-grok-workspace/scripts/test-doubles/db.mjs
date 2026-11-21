export async function getSql() {
  const sql = globalThis.__nextstepTestSql;
  if (typeof sql !== "function") throw new Error("Test SQL was not installed.");
  return sql;
}
