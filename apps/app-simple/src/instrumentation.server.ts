import { registerOTel } from '@vercel/otel';

if (process.env.VERCEL) {
  registerOTel({
    serviceName: 'app-simple',
  });
}
