import Metalsmith from "metalsmith";

export default permalinks;
/**
 * [Slugify options](https://github.com/simov/slugify#options)
 */
export type SlugifyOptions = {
    /**
     * extend known unicode symbols with a `{'char': 'replacement'}` object
     */
    extend: boolean;
    /**
     * replace spaces with replacement character, defaults to `-`
     */
    replacement?: string;
    /**
     * remove characters that match regex
     */
    remove?: RegExp;
    /**
     * convert to lower case, defaults to `true`
     */
    lower?: boolean;
    /**
     * strip special characters except replacement, defaults to `false`
     */
    strict?: boolean;
    /**
     * language code of the locale to use
     */
    locale?: string;
    /**
     * trim leading and trailing replacement chars, defaults to `true`
     */
    trim: boolean;
};
export type slugFunction = (filepath: string) => string;
/**
 * Linkset definition
 */
export type Linkset = {
    /**
     * A glob pattern or array of glob patterns passed to {@linkcode Metalsmith.match}, or an object whose `key:value` pairs
     * will be used to match files when at least one `key:value` pair matches, and transform their permalinks according to the rules in this linkset.
     * @default `**\/*.html`
     * @example
     * '**\/*.json' // only target JSON files
     * ['**\/*.md', '**\/*.html'] // pass multiple glob patterns
     * { product: true, service: true } // target files with either key:value match
     */
    match: string | string[] | {
        [x: string]: any;
    };
    /**
     * A permalink pattern to transform file paths into, e.g. `blog/:date/:title`.
     * @default ':dirname?/:basename'
     */
    pattern?: string;
    /**
     * [Slugify options](https://github.com/simov/slugify) or a custom slug function of the form `(pathpart) => string`
     * @default 
     * {
     *   lower: true, 
     *   remove: /[^\\w\\s$_+~.()!\\-@/]|[<>:"|?*]/g,
     *   extend: {':': '-', '|': '-', '/': '-', '<': '', '>': ''}
     * }
     */
    slug?: SlugifyOptions | slugFunction;
    /**
     * [Date format string](https://github.com/metalsmith/permalinks#dates) to transform Date link parts into, defaults to `YYYY/MM/DD`.
     * @default 'YYYY/MM/DD'
     */
    date?: string;
};
/**
 * `@metalsmith/permalinks` options & default linkset
 */
export type Options = {
    /**
     * Basename of the permalinked file (default: `index.html`)
     * @default 'index.html'
     */
    directoryIndex?: string;
    /**
     * Whether a trailing `/` should be added to the `file.permalink` property. Useful to avoid redirects on servers (like `express.js`) which do not have a built-in rewrite module enabled.
     * @default false
     */
    trailingSlash?: boolean;
    /**
     * How to handle duplicate target URI's.
     * @default 'error'
     */
    duplicates?: 'error'|'index'|'overwrite'|Function
    /**
     * An array of additional linksets.
     */
    linksets?: Linkset[];
} & Linkset;
/**
 * Metalsmith plugin that renames files so that they're permalinked properly
 * for a static site, aka that `about.html` becomes `about/index.html`.
 */
declare function permalinks(options: Options): Metalsmith.Plugin;
