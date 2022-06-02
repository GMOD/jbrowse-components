export interface Command {
  name: string
  args: unknown[]
}

export enum CallSchemaField {
  STRING,
  FLOAT,
  BOOL,
  FOLLOWING_ARGUMENTS_OPTIONAL,
}

export const setterDataTypes = {
  strokeStyle: [
    CallSchemaField.FOLLOWING_ARGUMENTS_OPTIONAL,
    CallSchemaField.STRING,
  ],
  font: [CallSchemaField.FOLLOWING_ARGUMENTS_OPTIONAL, CallSchemaField.STRING],
  fillStyle: [
    CallSchemaField.FOLLOWING_ARGUMENTS_OPTIONAL,
    CallSchemaField.STRING,
  ],
}

export const methodSignatures = {
  arc: [
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FOLLOWING_ARGUMENTS_OPTIONAL,
    CallSchemaField.BOOL,
  ],
  arcTo: [
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
  ],
  beginPath: [],
  bezierCurveTo: [
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
  ],
  clearRect: [
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
  ],
  closePath: [],
  ellipse: [
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FOLLOWING_ARGUMENTS_OPTIONAL,
    CallSchemaField.BOOL,
  ],
  fill: [CallSchemaField.FOLLOWING_ARGUMENTS_OPTIONAL, CallSchemaField.STRING],
  fillRect: [
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
  ],
  fillText: [
    CallSchemaField.STRING,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FOLLOWING_ARGUMENTS_OPTIONAL,
    CallSchemaField.FLOAT,
  ],
  lineTo: [CallSchemaField.FLOAT, CallSchemaField.FLOAT],
  moveTo: [CallSchemaField.FLOAT, CallSchemaField.FLOAT],
  quadraticCurveTo: [
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
  ],
  rect: [
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
  ],
  restore: [],
  rotate: [CallSchemaField.FLOAT],
  save: [],
  setTransform: [
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
  ],
  scale: [CallSchemaField.FLOAT, CallSchemaField.FLOAT],
  stroke: [],
  strokeRect: [
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
  ],
  strokeText: [
    CallSchemaField.STRING,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FOLLOWING_ARGUMENTS_OPTIONAL,
    CallSchemaField.FLOAT,
  ],
  transform: [
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
    CallSchemaField.FLOAT,
  ],
  translate: [CallSchemaField.FLOAT, CallSchemaField.FLOAT],
}

export type SetterName = keyof typeof setterDataTypes
export type MethodName = keyof typeof methodSignatures

export interface SetterCall extends Command {
  name: SetterName
}

export interface MethodCall extends Command {
  name: MethodName
}

export function isMethodCall(call: Command): call is MethodCall {
  return Boolean(call.name in methodSignatures)
}
export function isSetterCall(call: Command): call is SetterCall {
  return Boolean(call.name in setterDataTypes)
}
