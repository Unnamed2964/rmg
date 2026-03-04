import { ColourHex } from '@railmapgen/rmg-palette-resources';
import { ExtendedInterchangeInfo, Facilities, InterchangeGroup } from '../../constants/constants';
import { useRootSelector } from '../../redux';
import { forwardRef, memo, Ref, SVGProps, useEffect, useMemo, useRef, useState } from 'react';
import { Translation } from '@railmapgen/rmg-translate';

/**
 * Typography layout parameters for a line-number interchange badge.
 * Ported from kyuri-shmetro-line-id-block-generator (MIT), scaled to rmg's
 * coordinate system (rect height 22 px).
 *
 * Scaling rules (2020 style):
 *   - fontSize:       23 px = round(22 × 104/100)  → fills the block like the real badge
 *   - rectWidth:      19 px (1-digit)  = round(22 × 86/100)  ← kyuri ratio 0.86
 *                     23 px (2-digit)  = round(22 × 105/100)
 *   - textX:          kyuri_x × (rectWidth / kyuri_rectWidth)
 *                     single: × (20/86 ≈ 0.233) — kyuri x from {7.5, 14.9}
 *                     double: × (23/105 ≈ 0.219) — kyuri x from {3.6, -3.3, 7.4, 0.7}
 *   - textAnchor:     "start" (kyuri uses bbox left-corner positioning)
 *   - letterSpacing:  kyuri_value × (23/104 ≈ 0.221)
 */
interface IntBoxNumberLayout {
    rectWidth: number;
    textX: number;
    textAnchor?: 'start' | 'middle'; // default: inherit from parent ("middle")
    fontSize?: number;
    letterSpacing?: number;
    textTransform?: string;
}

function getIntBoxNumberLayout(lineName: string, is2020: boolean): IntBoxNumberLayout {
    if (!is2020) return { rectWidth: 20, textX: 10 };
    const num = parseInt(lineName.match(/^(\d+)/)?.[1] ?? '0', 10);
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    // 2020 style — rect x=0, text uses start-anchor with kyuri scaled x
    // double-digit (kyuri rect width 105 → rmg 23 px, scale 23/105 ≈ 0.219)
    if (num === 11) return { rectWidth: 23, textX: 0.8, textAnchor: 'start', fontSize: 23, letterSpacing: -2.3 }; // kyuri x=3.6
    if (tens === 1) return { rectWidth: 23, textX: -0.7, textAnchor: 'start', fontSize: 23, letterSpacing: -3.1 }; // kyuri x=-3.3
    if (tens >= 2 && ones === 1)
        return { rectWidth: 23, textX: 1.6, textAnchor: 'start', fontSize: 23, letterSpacing: -2.1 }; // kyuri x=7.4
    if (tens >= 2)
        return {
            rectWidth: 23,
            textX: 0.2,
            textAnchor: 'start',
            fontSize: 23,
            letterSpacing: -1.2,
            textTransform: 'scale(.98 1)',
        }; // kyuri x=0.7
    // single-digit (kyuri rect 86×100 → rmg 19×22 px, scale 19/86 ≈ 0.221)
    if (num === 1) return { rectWidth: 19, textX: 1.7, textAnchor: 'start', fontSize: 23 }; // kyuri x=7.5
    return { rectWidth: 19, textX: 3.3, textAnchor: 'start', fontSize: 23 }; // kyuri x=14.9
}

interface Props {
    stnId: string;
    stnState: -1 | 0 | 1;
    color?: ColourHex; // Control the station color if coline is in effect.
    bank?: -1 | 0 | 1; // Loopline requires station element to be horizontal. Default to 0 (no bank to other side).
    direction?: 'l' | 'r'; // Loopline requires station element to change direction. Default to current param.
}

const StationSHMetro = (props: Props) => {
    const { stnId, stnState, color, bank: bank_, direction: direction_override } = props;
    const { direction: direction_param, info_panel_type, stn_list, loop } = useRootSelector(store => store.param);
    const stnInfo = stn_list[stnId];
    const direction = direction_override ?? direction_param;

    // shift station name if the line bifurcate here
    // no shift for loop as there is no vertical line covering the station
    const branchNameDX = loop
        ? 0
        : (stnInfo.parents.length > 1 || stnInfo.children.length > 1
              ? 8 + 12 * (stnInfo.localisedName.en?.split('\\')?.length ?? 1)
              : 0) * (direction === 'r' ? -1 : 1);

    let stationIconStyle: string;
    const stationIconColor: { [pos: string]: string } = {};
    if (info_panel_type === 'sh2020') {
        if (stnInfo.services.length === 3) stationIconStyle = 'stn_sh_2020_direct';
        else if (stnInfo.services.length === 2) stationIconStyle = 'stn_sh_2020_express';
        else stationIconStyle = 'stn_sh_2020';
        stationIconColor.fill = stnState === -1 ? 'gray' : color ? color : 'var(--rmg-theme-colour)';
    } else {
        // param.info_panel_type === 'sh' or others (from other styles)
        if (stnInfo.services.length === 3) stationIconStyle = 'direct_sh';
        else if (stnInfo.services.length === 2) stationIconStyle = 'express_sh';
        else if ([...(stnInfo.transfer.groups[0].lines || []), ...(stnInfo.transfer.groups[1]?.lines || [])].length > 0)
            stationIconStyle = 'int2_sh';
        else stationIconStyle = 'stn_sh';
        stationIconColor.stroke = stnState === -1 ? 'gray' : color ? color : 'var(--rmg-theme-colour)';
    }

    const bank = bank_ ?? 0;
    const dx = (direction === 'l' ? 6 : -6) + branchNameDX + bank * 30;
    const dy = (info_panel_type === 'sh2020' ? -20 : -6) + Math.abs(bank) * (info_panel_type === 'sh2020' ? 25 : 11);
    const dr = bank ? 0 : direction === 'l' ? -45 : 45;
    const is2020 = info_panel_type === 'sh2020';
    return (
        <>
            <use
                xlinkHref={`#${stationIconStyle}`}
                {...stationIconColor} // different styles use either `fill` or `stroke`
                // sh and sh2020 have different headings of int_sh, so -1 | 1 is multiplied
                transform={
                    `translate(${bank * (info_panel_type === 'sh2020' ? 5 : 0)},0)` +
                    `rotate(${bank * 90 * (info_panel_type === 'sh2020' ? 1 : -1)})`
                }
            />
            <g transform={`translate(${dx},${dy})rotate(${dr})`}>
                <StationNameGElement
                    name={stnInfo.localisedName}
                    groups={stnInfo.transfer.groups}
                    stnState={stnState}
                    direction={direction}
                    facility={stnInfo.facility}
                    bank={bank}
                    oneLine={stnInfo.one_line}
                    intPadding={stnInfo.int_padding}
                    is2020={is2020}
                />
            </g>
            {stnState === 0 ? <CurrentStationText /> : undefined}
        </>
    );
};

export default StationSHMetro;

interface StationNameGElementProps {
    name: Translation;
    groups: InterchangeGroup[];
    stnState: -1 | 0 | 1;
    direction: 'l' | 'r';
    facility?: Facilities;
    bank: -1 | 0 | 1;
    oneLine: boolean;
    intPadding: number;
    /** When true, applies SHMetro 2020-style precision typography to line-number badges. */
    is2020?: boolean;
}

const StationNameGElement = (props: StationNameGElementProps) => {
    const { name, groups, stnState, direction, facility, bank, oneLine, intPadding, is2020 } = props;

    // legacy ref to get the exact station name width
    const stnNameEl = useRef<SVGGElement | null>(null);

    // simplify the calculation times
    const directionPolarity = direction === 'l' ? 1 : -1;

    // main elements icon's dx will change if there is a facility icon or not
    const mainDx = facility ? 30 : 0;

    // interchange will have a line under the name, and should be stretched when placed horizontal in loop
    const lineDx = bank ? -12 : 0;

    const intEl = useRef<SVGGElement | null>(null);
    const [intWidth, setIntWidth] = useState(0);
    useEffect(() => setIntWidth(intEl.current?.getBBox().width ?? 0), [JSON.stringify(groups)]);
    const intDx = intPadding - intWidth;

    return (
        <>
            {groups.map(group => group.lines ?? []).flat().length > 0 && (
                <>
                    <line
                        x1={(lineDx + mainDx) * directionPolarity}
                        x2={intDx * directionPolarity}
                        stroke={stnState === -1 ? 'gray' : 'black'}
                        strokeWidth={0.5}
                    />
                    <IntBoxGroup
                        ref={intEl}
                        groups={groups}
                        direction={direction}
                        is2020={is2020}
                        transform={`translate(${intDx * directionPolarity},-10.75)`}
                    />
                </>
            )}

            {facility && <use xlinkHref={'#' + facility} x={10 * directionPolarity} y={-30} />}

            <g
                textAnchor={direction === 'l' ? 'start' : 'end'}
                transform={`translate(${mainDx * directionPolarity},-14)`}
            >
                <StationName
                    ref={stnNameEl}
                    stnName={name}
                    oneLine={oneLine}
                    directionPolarity={directionPolarity}
                    fill={stnState === -1 ? 'gray' : stnState === 0 ? 'red' : 'black'}
                />

                {/* this is out-of-station text displayed above the IntBoxGroup */}
                {groups[1]?.lines?.length && (
                    <g transform={`translate(${(intDx + intWidth / 2) * directionPolarity},-30)`}>
                        <OSIText osiInfos={groups[1].lines} />
                    </g>
                )}

                {/* deal out-of-system here as it's dx is fixed and has nothing to do with IntBoxGroup */}
                {groups[2]?.lines?.length && (
                    <g transform={`translate(${(intPadding + 5) * directionPolarity},0)`}>
                        <OSysIText osysiInfos={groups[2].lines} direction={props.direction} />
                    </g>
                )}
            </g>
        </>
    );
};

const StationName = forwardRef(function StationName(
    props: { stnName: Translation; oneLine: boolean; directionPolarity: 1 | -1 } & SVGProps<SVGGElement>,
    ref: Ref<SVGGElement>
) {
    const { stnName, oneLine, directionPolarity, ...others } = props;
    const { zh: zhName = '', en: enName = '' } = stnName;

    const zhEl = useRef<SVGGElement | null>(null);
    const [enDx, setEnDx] = useState(0);
    useEffect(() => {
        if (oneLine && zhEl.current) setEnDx(zhEl.current.getBBox().width + 5);
        else setEnDx(0);
    }, [stnName.zh, stnName.en, oneLine]);

    const [ZH_HEIGHT, EN_HEIGHT] = [20, 8];

    return (
        <g ref={ref} {...others}>
            {useMemo(
                () => (
                    <>
                        <g ref={zhEl}>
                            {zhName.split('\\').map((txt, i, arr) => (
                                <text
                                    key={i}
                                    className="rmg-name__zh rmg-outline"
                                    dy={
                                        (arr.length - 1 - i) * -ZH_HEIGHT +
                                        (oneLine ? EN_HEIGHT : (enName.split('\\').length - 1) * -EN_HEIGHT)
                                    }
                                >
                                    {txt}
                                </text>
                            ))}
                        </g>
                        <g fontSize={8} transform={`translate(${enDx * directionPolarity},0)`}>
                            {enName.split('\\').map((txt, i, arr) => (
                                <text
                                    key={i}
                                    className="rmg-name__en rmg-outline"
                                    dy={(arr.length - 2 - i) * -EN_HEIGHT + 2}
                                >
                                    {txt}
                                </text>
                            ))}
                        </g>
                    </>
                ),
                [zhName, enName, oneLine, enDx, directionPolarity]
            )}
        </g>
    );
});

const CurrentStationText = () => {
    const { stn_list } = useRootSelector(store => store.param);
    const servicesPresent = new Set(
        Object.values(stn_list)
            .map(stn => stn.services)
            .flat()
    );
    const dy = [-1, 35, 50, 75][servicesPresent.size];

    return (
        <g transform={`translate(0, ${dy})`}>
            <text className="rmg-name__zh" fill="red" textAnchor="middle">
                本站
            </text>
        </g>
    );
};

const IntBoxGroup = forwardRef(function IntBoxGroup(
    props: { groups: InterchangeGroup[]; direction: 'l' | 'r'; is2020?: boolean } & SVGProps<SVGGElement>,
    ref: Ref<SVGGElement>
) {
    const { groups, direction, is2020, ...others } = props;

    // also known as non out-of-system transfers
    const boxInfos: ExtendedInterchangeInfo[] = [
        ...(groups[0].lines || []),
        ...(groups[1]?.lines || []),
        // some dirty tricks here as shmetro shows maglev icon even it is an out-of-system transfer
        // and display a maglev icon is much easier in boxInfos than in OSysIText
        ...(groups[2]?.lines?.filter(info => Boolean(info.name[0].match(/^磁(悬)*浮/))) || []),
    ];

    let dx = 0; // update in every boxInfos

    return (
        <g ref={ref} fontSize={14} textAnchor="middle" {...others}>
            {boxInfos.map((info, i) => {
                const isLineNumber = Boolean(info.name[0].match(/^\w+(号)?线/));
                const isMaglev = Boolean(info.name[0].match(/^磁(悬)*浮/));
                // For 2020 style, double-digit line-number badges are 25 px wide instead of 20 px
                const lineNumWidth = isLineNumber ? getIntBoxNumberLayout(info.name[0], is2020 ?? false).rectWidth : 0;
                const boxWidth = isLineNumber ? lineNumWidth : isMaglev ? 20 : info.name[0].length * 14 + 12;

                if (direction === 'r') {
                    dx -= boxWidth + (i === 0 ? 0 : 5);
                }

                let el: JSX.Element;
                if (isMaglev) {
                    el = (
                        <g transform={`translate(${dx},-16)scale(0.1428571429)`} key={i}>
                            <IntBoxMaglev info={info} />
                        </g>
                    );
                } else if (isLineNumber) {
                    el = (
                        <g transform={`translate(${dx},0)`} key={i}>
                            <IntBoxNumber info={info} is2020={is2020} />
                        </g>
                    );
                } else {
                    el = (
                        <g transform={`translate(${dx},0)`} key={i}>
                            <IntBoxLetter info={info} />
                        </g>
                    );
                }

                if (direction === 'l') {
                    dx += boxWidth + 5;
                }
                return el;
            })}
        </g>
    );
});

const IntBoxMaglev = memo(
    function IntBoxMaglev(props: { info: ExtendedInterchangeInfo }) {
        return (
            <>
                <use xlinkHref="#intbox_maglev" fill={props.info.theme?.[2]} stroke={props.info.theme?.[2]} />
            </>
        );
    },
    (prevProps, nextProps) => JSON.stringify(prevProps.info) === JSON.stringify(nextProps.info)
);

const IntBoxNumber = memo(
    function IntBoxNumber(props: { info: ExtendedInterchangeInfo; is2020?: boolean }) {
        const { info, is2020 } = props;
        // line starts with numbers
        const lineName = info.name[0].match(/(\d*)\w+/)?.[0] ?? '';
        const layout = getIntBoxNumberLayout(lineName, is2020 ?? false);
        return (
            <>
                {layout.textAnchor === 'start' ? (
                    // 2020 style: rect always starts at x=0, width varies
                    <rect x={0} y={-11} width={layout.rectWidth} height={22} fill={info.theme?.[2]} />
                ) : (
                    // Classic style (pre-2020): use shared def (x=0, width=20, y=-11)
                    <use xlinkHref="#intbox_number" fill={info.theme?.[2]} />
                )}
                <text
                    x={layout.textX}
                    className="rmg-name__zh"
                    fill={info.theme?.[3]}
                    dominantBaseline="central"
                    {...(layout.textAnchor !== undefined && { textAnchor: layout.textAnchor })}
                    {...(layout.fontSize !== undefined && { fontSize: layout.fontSize })}
                    {...(layout.letterSpacing !== undefined && { letterSpacing: layout.letterSpacing })}
                    {...(layout.textTransform !== undefined && { transform: layout.textTransform })}
                >
                    {lineName}
                </text>
            </>
        );
    },
    (prevProps, nextProps) =>
        JSON.stringify(prevProps.info) === JSON.stringify(nextProps.info) && prevProps.is2020 === nextProps.is2020
);

const IntBoxLetter = memo(
    function IntBoxLetter(props: { info: ExtendedInterchangeInfo }) {
        // box width: 16 * number of characters + 12
        const textCount = props.info.name[0].split('\\')[0].length;
        return (
            <>
                <rect height={22} width={textCount * 14 + 12} y={-11} fill={props.info.theme?.[2]} />
                <text
                    x={textCount * 7 + 6}
                    className="rmg-name__zh"
                    fill={props.info.theme?.[3]}
                    dominantBaseline="central"
                >
                    {props.info.name[0].split('\\')[0]}
                </text>
            </>
        );
    },
    (prevProps, nextProps) => JSON.stringify(prevProps.info) === JSON.stringify(nextProps.info)
);

const OSIText = (props: { osiInfos: ExtendedInterchangeInfo[] }) => {
    // get the all names from the out of station interchanges
    const lineNames = props.osiInfos.map(info => info.name[0]).join('，');
    return useMemo(
        () => (
            <g textAnchor="middle" fontSize="50%">
                <text className="rmg-name__zh" dy={-5}>
                    {`换乘${lineNames}`}
                </text>
                <text className="rmg-name__zh" dy={5}>
                    仅限公共交通卡
                </text>
                <text className="rmg-name__en" dy={12.5} fontSize="75%">
                    Only for Public Transportation Card
                </text>
            </g>
        ),
        [lineNames.toString()]
    );
};

const OSysIText = (props: { osysiInfos: ExtendedInterchangeInfo[]; direction: 'l' | 'r' }) => {
    // get the all names from out of system transfers
    const lineNames = props.osysiInfos.map(info => info.name[0]).join('，');
    const lineNamesEn = props.osysiInfos.map(info => info.name[1]).join(', ');

    return useMemo(
        () => (
            <g textAnchor={props.direction === 'l' ? 'start' : 'end'} fontSize="50%">
                <text className="rmg-name__zh" dy={3}>
                    转乘{lineNames}
                </text>
                <text className="rmg-name__en" dy={10} fontSize="75%">
                    To {lineNamesEn}
                </text>
            </g>
        ),
        [JSON.stringify(props.osysiInfos), props.direction]
    );
};
