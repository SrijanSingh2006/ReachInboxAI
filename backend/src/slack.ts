import axios from 'axios';
import { AppDataSource } from './db';
import { SlackConnection } from './entities/SlackConnection';

export const sendSlackNotification = async (senderId: string, message: string) => {
  try {
    const connectionRepo = AppDataSource.getRepository(SlackConnection);
    const connection = await connectionRepo.findOne({ where: { senderId } });
    if (!connection || !connection.webhookUrl) {
      console.log(`No slack connection found for sender: ${senderId}. Skipping notification.`);
      return;
    }

    await axios.post(connection.webhookUrl, {
      text: message
    });
    console.log(`Slack notification sent for sender ${senderId}`);
  } catch (error) {
    console.error('Error sending slack notification', error);
  }
};
