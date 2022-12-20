import { useQueryManager } from '../src';

describe('Test Query singleton', () => {

    it('should return the same instance when useQueryManager() is called multiple time', () => {
        const instance = useQueryManager();
        expect(instance).toBeInstanceOf(Function);
        expect(instance.invoke).toBeInstanceOf(Function);
        const instance2 = useQueryManager();
        expect(instance).toBe(instance2);
        const instance3 = useQueryManager();

        expect(instance).toBe(instance3);
        expect(instance2).toBe(instance3);
    });
});