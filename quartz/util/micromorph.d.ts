// micromorph 0.4.5 ships index.d.ts but omits it from its package exports.
declare module "micromorph" {
  const micromorph: typeof import("../../node_modules/micromorph/index").default
  export default micromorph
}
