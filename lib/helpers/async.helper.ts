

export class AsyncHelper{
    /**
     * Pauses the execution for a specified number of milliseconds.
     * @param ms The number of milliseconds to wait.
     */
    static wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}