export interface Phase<I, O> {
  readonly name: string;
  run(input: I): O;
}
export const makePhase = <I, O>(name: string, run: (i: I) => O): Phase<I, O> => ({ name, run });
