/**
 * Capitalizes the first character of a string.
 * @example capitalize('hello') // → 'Hello'
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a string to lower_snake_case.
 * Handles camelCase, spaces, and dashes.
 * @example
 * toLowerSnakeCase('myFileName')  // → 'my_file_name'
 * toLowerSnakeCase('My Photo')    // → 'my_photo'
 * toLowerSnakeCase('hello-world') // → 'hello_world'
 */
export function toLowerSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/[\s\-]+/g, '_')
    .replace(/^_/, '')
    .toLowerCase();
}
