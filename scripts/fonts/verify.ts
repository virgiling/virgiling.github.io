import {ensureFonts,python,projectRoot,generated} from './subset-ui-font';
import {join} from 'node:path';
await ensureFonts();
await python([join(projectRoot,'scripts/fonts/subset.py'),'verify',generated]);
