import * as React from 'react';
import { Config, PopperOptions, PropsGetterArgs } from './types';
export declare function usePopperTooltip(config?: Config, popperOptions?: PopperOptions): {
    state: import("@popperjs/core").State | null;
    update: (() => Promise<Partial<import("@popperjs/core").State>>) | null;
    forceUpdate: (() => void) | null;
    getArrowProps: (args?: PropsGetterArgs) => {
        style: React.CSSProperties;
        'data-popper-arrow': boolean;
    };
    getTooltipProps: (args?: PropsGetterArgs) => {
        'data-popper-interactive': boolean | undefined;
        style: React.CSSProperties;
    };
    setTooltipRef: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
    setTriggerRef: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
    tooltipRef: HTMLElement | null;
    triggerRef: HTMLElement | null;
    visible: boolean;
};
