export class MapperHelper {

    /**
     * Cleans a Cosmos DB document by removing system properties (those starting with an underscore)
     * and any additional specified properties.
     * @param document The Cosmos DB document to clean.
     * @param properties Optional array of property names to remove from the document.
     * @returns The cleaned document with specified properties removed.
     */
    static cleanCosmosDocument<T>(document: T, properties?: string[]): Partial<T> | T {
        const newDocument = Object.fromEntries(
            Object.entries(document).filter(([key]) => !key.startsWith("_"))
        );
        if (properties) {
            properties.forEach((property) => {
                delete newDocument[property];
            });
            return newDocument as Partial<T>;
        }
        return newDocument as T;
    }
}