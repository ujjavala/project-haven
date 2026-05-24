import amqplib, { Channel, ChannelModel } from 'amqplib';
import { HavenEvent, createLogger } from '@haven/shared';

const logger = createLogger('feed-service:publisher');
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
