import { inspect } from 'util'

export const booleanXOR = (a: boolean, b: boolean) => (a||b)&&!(a&&b)
export const proximatelyEqual = (x: number, y: number, error: number) => {
    return x <= y+error && x >= y-error
}
export const stringProximatelyEqual = (x: string, y: string, error: number) => {
    return proximatelyEqual(x.length, y.length, error) && Array.from(x).map((c, i) => c==y[i]).filter(x => !x).length <= error
}
export const logObject = (object: unknown) =>{console.log(inspect(object, {showHidden: false, depth: null, colors: true}))}