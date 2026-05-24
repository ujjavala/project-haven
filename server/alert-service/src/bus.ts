import amqplib, { Channel, ChannelModel } from 'amqplib';
import { HavenEvent, createLogger } from '@haven/shared';

const logger = createLogger('alert-service:bus');
let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export async function getChannel(): Promise<Channel> {
  if (channel) return channel;
  connection = await amqplib.connect(process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672');
  channel = await connection.createChannel();
  return channel;
}

export async function publish<T>(topic: string, event: HavenEvent<T>): Promise<void> {
  const ch = await getChannel();
  await ch.assertExchange(topic, 'fanout', { durable: true });
  ch.publish(topic, '', Buffer.from(JSON.stringify(event)));
  logger.info('Event published', { topic, eventId: event.eventId });
}

export async function subscribe(topic: string, handler: (msg: unknown) => Promise<void>): Promise<void> {
  const ch = await getChannel();
  await ch.assertExchange(topic, 'fanout', { durable: true });
  const q = await ch.assertQueue('', { exclusive: true });
  ch.bindQueue(q.queue, topic, '');
  ch.consume(q.queue, async (msg) => {
    if (!msg) return;
    try {
      await handler(JSON.parse(msg.content.toString()));
      ch.ack(msg);
    } catch (err) {
      logger.error('Handler failed', { error: String(err) });
      ch.nack(msg, false, false);
    }
  });
  logger.info('Subscribed', { topic });
}
