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
     * Whether this linkset should be used as the default instead
     */
    isDefault?: boolean;
    /**
     * An object whose key:value pairs will be used to match files and transform their permalinks according to the rules in this linkset
     */
    match: {
        [x: string]: any;
    };
    /**
     * A permalink pattern to transform file paths into, e.g. `blog/:date/:title`
     */
    pattern: string;
    /**
     * [Slugify options](https://github.com/simov/slugify) or a custom slug function of the form `(pathpart) => string`
     */
    slug?: SlugifyOptions | slugFunction;
    /**
     * [Moment.js format string](https://momentjs.com/docs/#/displaying/format/) to transform Date link parts into, defaults to `YYYY/MM/DD`.
     */
    date?: string;
};
/**
 * `@metalsmith/permalinks` options & default linkset
 */
export type Options = {
    /**
     * A permalink pattern to transform file paths into, e.g. `blog/:date/:title`
     */
    pattern?: string;
    /**
     * [Moment.js format string](https://momentjs.com/docs/#/displaying/format/) to transform Date link parts into, defaults to `YYYY/MM/DD`.
     */
    date?: string;
    /**
     * Basename of the permalinked file (default: `index.html`)
     */
    directoryIndex?: string;
    /**
     * Whether a trailing `/` should be added to the `file.permalink` property. Useful to avoid redirects on servers which do not have a built-in rewrite module enabled.
     */
    trailingSlash?: boolean;
    /**
     * How to handle duplicate target URI's.
     */
    duplicates?: 'error'|'index'|'overwrite'|Function
    /**
     * An array of additional linksets
     */
    linksets?: Linkset[];
    /**
     * {@link SlugifyOptions} or a custom slug function of the form `(pathpart) => string`
     */
    slug?: SlugifyOptions | slugFunction;
};
/**
 * Metalsmith plugin that renames files so that they're permalinked properly
 * for a static site, aka that `about.html` becomes `about/index.html`.
 */
declare function permalinks(options: Options): Metalsmith.Plugin;
