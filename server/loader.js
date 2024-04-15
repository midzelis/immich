export async function resolve(specifier, context, nextResolve) {
  console.log('loook', specifier, context);
  return nextResolve(specifier, context);
}

export function load(url, context, nextLoad) {
  console.log('load', url, context, context);
  return nextLoad(url, context);
}
