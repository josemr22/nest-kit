export class StringsHelper {
    
    /**
     * Converts the first character of the given string to uppercase.
     * @param str The input string.
     * @returns The string with the first character in uppercase.
     */
    static capitalizeFirstLetter(str: string): string {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    static toLowerSnakeCase(str: string): string {
        return str.toLowerCase().replace(/\s+/g, '_');
    }
}