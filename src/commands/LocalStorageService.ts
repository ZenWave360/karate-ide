import { Memento } from 'vscode';

export class LocalStorageService {
    public static instance: LocalStorageService;

    private constructor(private storage: Memento) {}

    public static initialize(storage: Memento) {
        this.instance = new LocalStorageService(storage);
    }

    public getValue<T>(key: string, defaultValue?: T): T {
        return this.storage.get<T>(key, defaultValue);
    }

    public setValue<T>(key: string, value: T) {
        this.storage.update(key, value);
    }
}
