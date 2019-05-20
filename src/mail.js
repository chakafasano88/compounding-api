
const sgMail = require('@sendgrid/mail');

const createEmail = text => {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  sgMail.send(text)
};

exports.createEmail = createEmail;