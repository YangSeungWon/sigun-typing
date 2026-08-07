/**
 * mapshaper는 타입 정의를 제공하지 않는다. 빌드 스크립트에서 쓰는
 * applyCommands 하나만 선언해 둔다.
 */
declare module "mapshaper" {
  export function applyCommands(
    commands: string,
    input: Record<string, Buffer | string>,
  ): Promise<Record<string, Uint8Array>>;

  const mapshaper: { applyCommands: typeof applyCommands };
  export default mapshaper;
}
