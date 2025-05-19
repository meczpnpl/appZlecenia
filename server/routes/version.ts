import { Router } from 'express';
import { version } from '@shared/config';

export const versionRouter = Router();

// Endpoint API dla wersji aplikacji - dostępny publicznie
versionRouter.get('/', (req, res) => {
  try {
    res.json({
      version: version.toString(),
      major: version.major,
      minor: version.minor,
      patch: version.patch,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting version:', error);
    res.status(500).json({ message: 'Nie udało się pobrać informacji o wersji' });
  }
});