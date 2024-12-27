const db = require('../db');
const bcrypt = require('bcrypt');
const jwtUtils = require('../token/jwtUtils');
const jwt = require("jsonwebtoken");
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const { google } = require('googleapis');

// Google Drive API setup
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const getDriveService = () => {

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.CLIENT_EMAIL,
      private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: SCOPES,
  });

  return google.drive({ version: 'v3', auth });
};

const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

async function applyJobProfile(req, res) {
  const { name, email, contact_no, current_location, role } = req.body;

  if (!req.files || !req.files.Resume) {
    return res.status(400).send('No file uploaded.');
  }

  const file = req.files.Resume;
  const driveService = getDriveService();

  // Save the file to a temporary path
  const tempFilePath = path.join(tempDir, file.name);
  await file.mv(tempFilePath);

  try {
    const fileMetadata = { name: file.name };
    const media = {
      mimeType: file.mimetype,
      body: fs.createReadStream(tempFilePath),
    };

    const response = await driveService.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    // Set file permissions to public
    await driveService.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Delete the temporary file
    fs.unlinkSync(tempFilePath);

    const resume_link = `https://drive.google.com/file/d/${response.data.id}/view`;

    const insertApplicationQuery = `
      INSERT INTO hr.job_applications (name, email, contact_no, current_location, role, resume_link)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    db.query(insertApplicationQuery, [name, email, contact_no, current_location, role, resume_link], async (insertApplicationError, insertApplicationResult) => {
      if (insertApplicationError) {
        return res.status(500).json({ message: 'Error submitting job application', error: insertApplicationError });
      }

      const newApplication = insertApplicationResult.rows[0];

      // Send acknowledgment email
      const transporter = nodemailer.createTransport({
        host: 'smtp.hostinger.com',
        port: 465,
        secure: true,
        auth: {
          user: "noreply@antiai.ltd",
          pass: "Pass@antiai123"
        },
      });

      const emailTemplatePath = path.join(__dirname,'../mail-body/application.ejs');
      const emailTemplate = fs.readFileSync(emailTemplatePath, 'utf-8');

      const emailContent = ejs.render(emailTemplate, {
        name: newApplication.name,
        role: newApplication.role,
        resume_link: resume_link,
      });

      const mailOptions = {
        from: 'noreply@antiai.ltd',
        to: newApplication.email,
        subject: 'Job Application Acknowledgment',
        html: emailContent,
      };

      try {
        await transporter.sendMail(mailOptions);
        res.status(201).json({
          message: 'Job application submitted successfully and acknowledgment email sent.',
          application: newApplication,
        });
      } catch (emailError) {
        console.error('Error sending acknowledgment email:', emailError);
        res.status(201).json({
          message: 'Job application submitted successfully, but failed to send acknowledgment email.',
          application: newApplication,
        });
      }
    });

  } catch (error) {
    console.error('Error uploading file to Google Drive:', error);
    res.status(500).json({ message: 'Error uploading file to Google Drive', error });
  }
}


async function submitServiceRequest(req, res) {
  const { email, companyName, phone, contactMethod, description, services } = req.body;

  if (!req.files || !req.files.pdfFile) {
    return res.status(400).send('No file uploaded.');
  }

  const file = req.files.pdfFile;
  const driveService = getDriveService();

  // Ensure the temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const tempFilePath = path.join(tempDir, file.name);

  try {
    // Move the file to the temporary directory
    await file.mv(tempFilePath);

    const fileMetadata = { name: file.name };
    const media = {
      mimeType: file.mimetype,
      body: fs.createReadStream(tempFilePath),
    };

    const response = await driveService.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    // Set file permissions to public
    await driveService.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Delete the temporary file
    fs.unlinkSync(tempFilePath);

    const pdfLink = `https://drive.google.com/file/d/${response.data.id}/view`;

    const insertQuery = `
      INSERT INTO hr.service_requests (email, company_name, phone, contact_method, description, services, pdf_link)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    db.query(
      insertQuery,
      [email, companyName, phone, contactMethod, description, services, pdfLink],
      (insertError, result) => {
        if (insertError) {
          console.error('Error inserting service request into database:', insertError);
          return res.status(500).json({ message: 'Error saving service request', error: insertError });
        }

        res.status(201).json({
          message: 'Service request submitted successfully',
          request: result.rows[0],
        });
      }
    );
  } catch (error) {
    console.error('Error handling file:', error);
    res.status(500).json({ message: 'Error processing the file', error });
  }
}


function postOpenPosition(req, res) {
    const { location, role, business_area } = req.body;

    if (!location || !role || !business_area) {
        return res.status(400).json({ message: 'All fields are required: location, role, business_area' });
    }

    const insertPositionQuery = `
        INSERT INTO hr.open_positions (location, role, business_area)
        VALUES ($1, $2, $3)
        RETURNING *
    `;

    db.query(insertPositionQuery, [location, role, business_area], (insertPositionError, insertPositionResult) => {
        if (insertPositionError) {
            return res.status(500).json({ message: 'Error creating open position', error: insertPositionError });
        }

        const newPosition = insertPositionResult.rows[0];
        res.status(201).json({ message: 'Open position created successfully', position: newPosition });
    });
}

function addDevice(req, res) {
  const { device_latitude, device_longitute, device_name, device_uid, location } = req.body;

  if (!device_latitude || !device_longitute || !device_name || !device_uid || !location) {
      return res.status(400).json({ message: 'All fields are required: location, role, business_area' });
  }

  const insertPositionQuery = `
      INSERT INTO hr.devlopers (location, role, name, id, business_area)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
  `;

  db.query(insertPositionQuery, [device_latitude, device_longitute, device_name, device_uid, location], (insertPositionError, insertPositionResult) => {
      if (insertPositionError) {
          return res.status(500).json({ message: 'Error creating open position', error: insertPositionError });
      }

      const newPosition = insertPositionResult.rows[0];
      res.status(201).json({ message: 'Open position created successfully', position: newPosition });
  });
}

function ApplicationStatus(req, res) {
  const id = req.params.id;
  const { status } = req.body;

  if (!status) {
      return res.status(400).json({ message: 'Status is required in the request body' });
  }

  const updateStatusQuery = `
      UPDATE hr.job_applications
      SET status = $1
      WHERE id = $2
  `;

  db.query(updateStatusQuery, [status, id], (updateError, updateResult) => {
      if (updateError) {
          console.error('Error updating job application status:', updateError);
          return res.status(500).json({ message: 'Error updating job application status', error: updateError });
      } else {
          console.log('Job application status updated successfully');
          return res.status(200).json({ message: 'Job application status updated successfully' });
      }
  });
}


function editOpenPosition(req, res) {
  const { id } = req.params;
  const { location, role, business_area } = req.body;

  if (!id || !location || !role || !business_area) {
      return res.status(400).json({ message: 'All fields are required: id (as parameter), location, role, business_area' });
  }

  const updatePositionQuery = `
      UPDATE hr.open_positions
      SET location = $1, role = $2, business_area = $3
      WHERE id = $4
      RETURNING *
  `;

  db.query(updatePositionQuery, [location, role, business_area, id], (updatePositionError, updatePositionResult) => {
      if (updatePositionError) {
          return res.status(500).json({ message: 'Error updating open position', error: updatePositionError });
      }

      if (updatePositionResult.rowCount === 0) {
          return res.status(404).json({ message: 'Open position not found' });
      }

      const updatedPosition = updatePositionResult.rows[0];
      res.status(200).json({ message: 'Open position updated successfully', position: updatedPosition });
  });
}

function deleteOpenPosition(req, res) {
  const { id } = req.params;

  if (!id) {
      return res.status(400).json({ message: 'Job position ID is required' });
  }

  const deletePositionQuery = `
      DELETE FROM hr.open_positions
      WHERE id = $1
      RETURNING *
  `;

  db.query(deletePositionQuery, [id], (deletePositionError, deletePositionResult) => {
      if (deletePositionError) {
          return res.status(500).json({ message: 'Error deleting open position', error: deletePositionError });
      }

      if (deletePositionResult.rowCount === 0) {
          return res.status(404).json({ message: 'Open position not found' });
      }

      const deletedPosition = deletePositionResult.rows[0];
      res.status(200).json({ message: 'Open position deleted successfully', position: deletedPosition });
  });
}


function fetchAllPosition(req, res) {
    try {
      const query = 'SELECT * FROM hr.open_positions';
      db.query(query, (error, result) => {
        if (error) {
          console.error('Error fetching data:', error);
          res.status(500).json({ message: 'Error fetching data', error: error.message });
          return;
        }
        
        res.json(result.rows);
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }


function calculate(req, res) {
    try {
        // Define the constant object
        const user = {
            username: 'test',
            password: 'test'
        };

        // Log the user object to the console
        console.log('Sending user data:', user);

        // Send the constant object as a JSON response
        console.log(user);

    } catch (error) {
        // Catch and log any unexpected errors
        console.error('Error processing request:', error);
    }
}


function fetchAllApplicants(req, res) {
    try {
        // Updated SQL query to order by created_at in descending order
        const query = 'SELECT * FROM hr.job_applications ORDER BY created_at DESC';

        // Execute the query
        db.query(query, (error, result) => {
            if (error) {
                // Log the error and send a 500 status with error details
                console.error('Error fetching data:', error);
                res.status(500).json({ message: 'Error fetching data', error: error.message });
                return;
            }

            // Send the result as a JSON response
            res.json(result.rows);
        });
    } catch (error) {
        // Catch and log any unexpected errors
        console.error('Error fetching data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

function fetchAllServices(req, res) {
  try {
      // Updated SQL query to order by created_at in descending order
      const query = 'SELECT * FROM hr.service_requests ORDER BY created_at DESC';

      // Execute the query
      db.query(query, (error, result) => {
          if (error) {
              // Log the error and send a 500 status with error details
              console.error('Error fetching data:', error);
              res.status(500).json({ message: 'Error fetching data', error: error.message });
              return;
          }

          // Send the result as a JSON response
          res.json(result.rows);
      });
  } catch (error) {
      // Catch and log any unexpected errors
      console.error('Error fetching data:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
}

function postClientInquiry(req, res) {
  const { email, companyName, phone, contactMethod, description, services } = req.body;
  const pdfFile = req.file; // Assumes `multer` or similar middleware is used to handle file uploads.

  // Validate required fields
  if (!email || !companyName || !phone || !contactMethod || !description || !services || !pdfFile) {
      return res.status(400).json({ 
          message: 'All fields are required: email, companyName, phone, contactMethod, description, services, pdfFile' 
      });
  }

  const insertInquiryQuery = `
      INSERT INTO client_inquiries (email, company_name, phone, contact_method, description, services, pdf_file)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
  `;

  const pdfBuffer = pdfFile.buffer; // Assuming the binary data is in `buffer`.

  db.query(
      insertInquiryQuery, 
      [email, companyName, phone, contactMethod, description, services, pdfBuffer],
      (insertError, insertResult) => {
          if (insertError) {
              return res.status(500).json({ message: 'Error creating client inquiry', error: insertError });
          }

          const newInquiry = insertResult.rows[0];
          res.status(201).json({ 
              message: 'Client inquiry created successfully', 
              inquiry: newInquiry 
          });
      }
  );
}

  

module.exports = {
    postOpenPosition,
    fetchAllPosition,
    applyJobProfile,
    fetchAllApplicants,
    editOpenPosition,
    deleteOpenPosition,
    ApplicationStatus,
    addDevice,
    postClientInquiry,
    submitServiceRequest,
    fetchAllServices
 }