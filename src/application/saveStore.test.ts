import { describeSaveStore } from './__fixtures__/saveStoreContract';
import { createMemorySaveStore } from './saveStore';

describeSaveStore('archivio in memoria', (initial) => createMemorySaveStore(initial));
