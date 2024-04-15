export async function resolve(specifier: any, context: any, nextResolve: any) {
  console.log(specifier);
  return nextResolve(specifier, context, nextResolve);
}
