import { createApp } from './app.ts';

const PORT = Number(process.env.PORT || 3000);
const app = createApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Internal Fleet Management System server running on http://localhost:${PORT}`);
});
