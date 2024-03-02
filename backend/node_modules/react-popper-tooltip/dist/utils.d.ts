export declare function useGetLatest<T>(val: T): () => T;
export declare function useControlledState<T>({ initial, value, onChange, }: {
    initial?: T;
    value?: T;
    onChange?: (state: T) => void;
}): [T, (state: T) => void];
export declare function generateBoundingClientRect(x?: number, y?: number): () => DOMRect;
