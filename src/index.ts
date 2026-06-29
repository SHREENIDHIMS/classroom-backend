import 'dotenv/config';
import app from './app.js';

const port = Number(process.env.PORT) || 8000;

app.listen(port, () => {
    console.log(`🚀 Server started on http://localhost:${port}`);
});

process.on('SIGTERM', () => { console.log('SIGTERM received. Exiting.'); process.exit(0); });
process.on('SIGINT',  () => { console.log('SIGINT received. Exiting.');  process.exit(0); });