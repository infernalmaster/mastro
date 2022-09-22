const t = require('@babel/types');
const { mkdirSync, writeFileSync } = require('fs');
const { basename, dirname, extname, join, relative } = require('path');
// const { NodePath } = require('@babel/core');
const { NodePath, visitors } = require('@babel/traverse');
const cssFilesCache = require('./mastroCache')

// getDisplayName
// https://github.com/babel/babel/blob/main/packages/babel-plugin-transform-react-display-name/src/index.ts

function getNameFromPath(path) {
  if (path.isIdentifier() || path.isJSXIdentifier()) {
    return path.node.name;
  }
  if (path.isMemberExpression() || path.isJSXMemberExpression()) {
    return path.get('property').node.name || path.get('property').node.value
  }

  return null;
}

const getComponentNameFromFileName = s => 
  s.split(/ |-|_/).map(s => s[0].toUpperCase() + s.slice(1).toLocaleLowerCase()).join('')

function getNameFromFile(fileName) {
  let displayName = basename(fileName, extname(fileName));

  // ./{module name}/index.js
  if (displayName === "index") {
    displayName = basename(dirname(fileName));
  }

  return getComponentNameFromFileName(displayName);
}

function getDisplayName(path, { file }) {
  path = path.parentPath

  if (path.isVariableDeclarator()) {
    // TODO: allow only root level components
    // named export is also variable declaration
    // if (!path.parentPath.parentPath.isProgram()) {
    //   throw path.buildCodeFrameError('Should be root level declaration')
    // }

    return getNameFromPath(
      path.get('id')
    );
  }

  if (path.isExportDefaultDeclaration()) {
    return getNameFromFile(file.opts.filename);
  }
  
  throw path.buildCodeFrameError(
    path.findParent((p) => p.isExpressionStatement())
      ? 'The output of this styled component is never used. Either assign it to a variable or export it.'
      : 'Could not determine a displayName for this styled component. Each component must be uniquely identifiable, either as the default export of the module or by assigning it to a unique identifier',
  );
}

// isStyledTag

function hasAttrs(calleePath) {
  return (
    calleePath.isMemberExpression() &&
    calleePath.get('property').node.name === 'attrs'
  );
}

function isAttrsExpression(calleePath) {
  return hasAttrs(calleePath) && isStyledTag(calleePath.get('object'));
}

function isStyledExpression (calleePath) {
  return calleePath.referencesImport('./mastro/react', 'default')
}

function isStyledTag(tagPath) {
  const callee = tagPath.get('callee');

  return (
    tagPath.isCallExpression() && (
      isStyledExpression(callee) ||
      isAttrsExpression(callee)
    )
  );
}

// ----  build component

const buildComponent = (nodes) =>
  t.callExpression(nodes.TAG, [
    nodes.ELEMENTTYPE,
    nodes.OPTIONS,
    t.objectExpression(
      [
        t.objectProperty(t.identifier('displayName'), nodes.DISPLAYNAME),
        t.objectProperty(t.identifier('styles'), nodes.IMPORT),
        !t.isNullLiteral(nodes.ATTRS) &&
          t.objectProperty(t.identifier('attrs'), nodes.ATTRS),
        nodes.VARS.elements.length &&
          t.objectProperty(t.identifier('vars'), nodes.VARS),
        nodes.VARIANTS.elements.length &&
          t.objectProperty(t.identifier('variants'), nodes.VARIANTS),
      ].filter(Boolean),
    ),
  ]);

function normalizeAttrs(node) {
  if (!node) return t.nullLiteral();
  if (!t.isObjectExpression(node)) return node;

  const { properties } = node;

  const propsIdent = t.identifier('props');
  return t.arrowFunctionExpression(
    [propsIdent],
    t.objectExpression([t.spreadElement(propsIdent), ...properties]),
  );
}

const findTopLevel = (path) => {
  if (path.parentPath.isProgram()) {
    return path
  }

  return findTopLevel(path.parentPath)
}


const rImports = /@(?:import|use|forward).*?(?:$|;)/g;
function hoistImports(text) {
  const imports = [];

  let match;
  // eslint-disable-next-line no-cond-assign
  while ((match = rImports.exec(text))) {
    imports.push(match[0]);
  }

  return [
    text.replace(rImports, ''), 
    imports
  ];
}

function wrapInClass(text) {
  const [ruleset, imports] = hoistImports(text);

  // Components need two css classes, the actual style declarations and a hook class.
  // We need both so that that interpolations have a class that is _only_
  // the single class, e.g. no additional classes composed in so that it can be used
  // as a selector
  //
  // comment prevents Sass from removing the empty class
  return `
${imports.join('\n')}
.cls1 { /*!*/ }
.cls2 {
  composes: cls1;
  ${ruleset}
}`;
}

function injectStyledComponent(
  path,
  elementType,
  opts,
) {
  const { file, pluginOptions, styledAttrs, styledOptions, styleImports } = opts;
  // const cssState = file.get(STYLES);
  // const nodeMap = file.get(COMPONENTS);
  const displayName = getDisplayName(path, opts);
  const fileName = file.opts.filename

  // const baseStyle = {}// createStyleNode(path, displayName, opts);
  // const style = {
  //   ...baseStyle,
  //   type: 'styled',
  //   interpolations: [],
  //   imports: '',
  //   value: '',
  // };

  // const importId = styleImports.add(style);

  // const { css, vars, variants, interpolations } = buildTaggedTemplate({
  //   style,
  //   nodeMap,
  //   importId,
  //   location: 'COMPONENT',
  //   quasiPath: path.get('quasi')
  //   pluginOptions 
  // });

  // style.interpolations = interpolations;
  // style.value = css;

  const css = wrapInClass(
    path.get('quasi').evaluate().value
    // file.code.slice(path.get('quasi').node.start + 1, path.get('quasi').node.end - 1)
  )

  let fileCache = cssFilesCache.get(fileName)
  if (!fileCache) {
    fileCache = new Map()
    cssFilesCache.set(fileName, fileCache)
  }

  fileCache.set(displayName, css)

  // insert style import
  const topLevelPath = findTopLevel(path)
  const styleIdentifier = topLevelPath.scope.generateUidIdentifier(displayName)
  const importNode = t.importDeclaration(
    [t.importDefaultSpecifier(styleIdentifier)], 
    t.stringLiteral(`./${displayName}.module.css!=!mastro/style-loader?style=1!${file.opts.filename}?${displayName}`)
  );
  topLevelPath.insertBefore(importNode);


  const runtimeNode = buildComponent({
    TAG: t.identifier('styled'),
    ELEMENTTYPE: elementType,
    ATTRS: normalizeAttrs(styledAttrs),
    OPTIONS: styledOptions || t.nullLiteral(),
    DISPLAYNAME: t.stringLiteral(displayName),

    // VARS: vars,
    // VARIANTS: variants,
    VARS: t.arrayExpression([]),
    VARIANTS: t.arrayExpression([]),
    IMPORT: styleIdentifier
  });

  // if (pluginOptions.generateInterpolations) {
  //   style.code = `/*#__PURE__*/${generate(runtimeNode).code}`;
  // }

  // style.importIdentifier = importId.name;

  // cssState.styles.set(style.absoluteFilePath, style);
  // nodeMap.set(runtimeNode, style);

  path.replaceWith(runtimeNode);
  path.addComment('leading', '#__PURE__');
}



function mastro(babel) {
  return {
    // pre(file) {
    //   file.set(IMPORTS, []);

    //   if (!file.has(STYLES)) {
    //     file.set(STYLES, {
    //       id: 0,
    //       changeset: [],
    //       styles: new Map(),
    //     });
    //   }

    //   if (!file.has(COMPONENTS)) {
    //     file.set(COMPONENTS, new Map());
    //   }
    // },

    // post(file) {
    //   const { opts } = this;
    //   // eslint-disable-next-line prefer-const
    //   let { styles, changeset } = file.get(STYLES);

    //   const styleList = Array.from(styles.values());

    //   changeset = changeset.concat(styleList);

    //   file.metadata.astroturf = { styles: styleList, changeset };

    //   if (opts.writeFiles !== false) {
    //     styles.forEach(({ absoluteFilePath, value }) => {
    //       // @ts-ignore
    //       mkdirSync(dirname(absoluteFilePath), { recursive: true });
    //       // writeFileSync(absoluteFilePath, stripIndent([value] as any));
    //       writeFileSync(absoluteFilePath, value);
    //     });
    //   }
    // },
    visitor: visitors.merge([
      // {
      //   Program: {
      //     enter(path, state) {
      //       state.styleImports = new ImportInjector(path);
      //       state.defaultedOptions = {
      //         extension: '.module.css',
      //         cssTagName: 'css',
      //         styledTagName: 'styled',
      //         stylesheetTagName: 'stylesheet',
      //         allowGlobal: false,
      //         enableCssProp: true,
      //         jsxPragma: true,
      //         enableDynamicInterpolations: 'cssProp',
      //         experiments: {},
      //         ...state.opts
      //       }

      //       const pragma = state.defaultedOptions.jsxPragma;

      //       // We need to re-export Fragment because of
      //       // https://github.com/babel/babel/pull/7996#issuecomment-519653431
      //       state[JSX_IDENTS] = {
      //         jsx:
      //           typeof pragma === 'string'
      //             ? t.identifier(pragma)
      //             : path.scope.generateUidIdentifier('j'),
      //       };
      //     },
      //   },

      //   ImportDeclaration: {
      //     exit(path, state) {
      //       const { cssTagName, stylesheetTagName } = state.defaultedOptions;
      //       const specifiers = path.get('specifiers');
      //       const tagImports = path
      //         .get('specifiers')
      //         .filter(
      //           (p) =>
      //             p.isImportSpecifier() &&
      //             ['css', 'stylesheet'].includes(getName(p.node.imported)) &&
      //             [cssTagName, stylesheetTagName].includes(p.node.local.name),
      //         );

      //       if (!tagImports.length) return;
      //       // if the tagImports are ALL of the imported values then we want
      //       // to pass the entire import to be removed.

      //       state.file.get(IMPORTS).push({
      //         path,
      //         specifiers:
      //           specifiers.length === tagImports.length ? null : tagImports,
      //       });
      //     },
      //   },
      // },
      {
        TaggedTemplateExpression(path, state) {
          const pluginOptions = state.defaultedOptions;

          const tagPath = path.get('tag');

          if (!isStyledTag(tagPath)) return

          let styledOptions, componentType, styledAttrs;

          if (hasAttrs(tagPath.get('callee'))) {
            styledAttrs = tagPath.node.arguments[0];

            const styled = tagPath.get('callee.object');
            componentType = styled.node.arguments[0];
            styledOptions = styled.node.arguments[1];
          } else {
            componentType = tagPath.node.arguments[0];
            styledOptions = tagPath.node.arguments[1];
          }

          injectStyledComponent(path, componentType, {
            pluginOptions,
            styledAttrs,
            styledOptions,
            file: state.file,
            styleImports: state.styleImports,
          })
        }
      },
      // {
      //   Program: {
      //     exit(_, { opts, file, styleImports }) {
      //       // eslint-disable-next-line prefer-const
      //       let { changeset } = file.get(STYLES);

      //       const importNodes = file.get(IMPORTS);

      //       importNodes.forEach(({ path, specifiers }) => {
      //         if (!path) return;

      //         const { start, end } = path.node;

      //         if (specifiers) {
      //           specifiers.forEach((s) => s.remove());
      //         } else {
      //           path.remove();
      //         }

      //         if (opts.generateInterpolations)
      //           changeset.push({
      //             type: 'import-optimization',
      //             start: start,
      //             end: end,
      //             // if the path is just a removed specifier we need to regenerate
      //             // the import statement otherwise we remove the entire declaration
      //             code: specifiers ? generate(path.node).code : '',
      //           });
      //       });

      //       changeset.push(styleImports.inject());
      //     },
      //   },
      // },
    ])
  };
}

exports.mastro = mastro
