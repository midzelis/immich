import jscodeshift, { API, ASTPath, FileInfo, ImportDeclaration, JSCodeshift } from 'jscodeshift';
import path from 'node:path';

const replaceImportPath = (j: JSCodeshift, node: ASTPath<ImportDeclaration>, filePath: string) => {
  const imp = node.value.source.value as string;

  if (imp.startsWith('src/') || imp.startsWith('test/')) {
    let p = filePath.split('/');
    p.pop();

    const baseFile = path.join(process.cwd(), p.join('/'));
    const targetImport = path.join(process.cwd(), imp);
    let relative = path.relative(baseFile, targetImport);
    if (!relative.startsWith('.')) {
      relative = './' + relative;
    }
    console.log('fp', baseFile, targetImport, relative);
    return j.importDeclaration(node.value.specifiers, j.literal(relative));
  }
  return j.importDeclaration(node.value.specifiers, node.value.source);

  // j.importDeclaration(node.value.specifiers, j.literal(getAbsolutePath(node.value.source.value as string, filePath)));
};

export default function transformer(file: FileInfo, api: API) {
  const j = api.jscodeshift;
  const filePath = file.path;
  const root = j(file.source);

  return j(file.source)
    .find(j.ImportDeclaration)
    .replaceWith((node: ASTPath<ImportDeclaration>) => replaceImportPath(j, node, filePath))
    .toSource();
}
