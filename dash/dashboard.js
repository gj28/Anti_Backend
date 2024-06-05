const db = require('../db');
const bcrypt = require('bcrypt');
const jwtUtils = require('../token/jwtUtils');
const jwt = require("jsonwebtoken");
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

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

function fetchAllPosition(req, res) {
    try {
      const query = 'SELECT * FROM hr.open_positions';
      db.query(query, (error, result) => {
        if (error) {
          console.error('Error fetching data:', error);
          res.status(500).json({ message: 'Error fetching data', error: error.message });
          return;
        }
        
        const data = result.rows; 
        
        res.json({ data });
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

//   function applyJobProfile(req, res) {
//     const { name, email, contact_no, current_location, role, resume_link } = req.body;

//     if (!name || !email || !contact_no || !current_location || !role || !resume_link) {
//         return res.status(400).json({ message: 'All fields are required: name, email, contact_no, current_location, role, resume_link' });
//     }

//     const insertApplicationQuery = `
//         INSERT INTO hr.job_applications (name, email, contact_no, current_location, role, resume_link)
//         VALUES ($1, $2, $3, $4, $5, $6)
//         RETURNING *
//     `;

//     db.query(insertApplicationQuery, [name, email, contact_no, current_location, role, resume_link], (insertApplicationError, insertApplicationResult) => {
//         if (insertApplicationError) {
//             return res.status(500).json({ message: 'Error submitting job application', error: insertApplicationError });
//         }

//         const newApplication = insertApplicationResult.rows[0];
//         res.status(201).json({ message: 'Job application submitted successfully', application: newApplication });
//     });
// }

function applyJobProfile(req, res) {
    const { name, email, contact_no, current_location, role, resume_link } = req.body;

    if (!name || !email || !contact_no || !current_location || !role || !resume_link) {
        return res.status(400).json({ message: 'All fields are required: name, email, contact_no, current_location, role, resume_link' });
    }

    const gdriveRegex = /^https:\/\/drive\.google\.com\//;

    if (!gdriveRegex.test(resume_link)) {
        return res.status(400).json({ message: 'Only Google Drive links are accepted for resume_link' });
    }

    const insertApplicationQuery = `
        INSERT INTO hr.job_applications (name, email, contact_no, current_location, role, resume_link)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;

    db.query(insertApplicationQuery, [name, email, contact_no, current_location, role, resume_link], (insertApplicationError, insertApplicationResult) => {
        if (insertApplicationError) {
            return res.status(500).json({ message: 'Error submitting job application', error: insertApplicationError });
        }

        const newApplication = insertApplicationResult.rows[0];
        res.status(201).json({ message: 'Job application submitted successfully', application: newApplication });
    });
}

function fetchAllapplicant(req, res) {
    try {
      const query = 'SELECT * FROM hr.job_applications';
      db.query(query, (error, result) => {
        if (error) {
          console.error('Error fetching data:', error);
          res.status(500).json({ message: 'Error fetching data', error: error.message });
          return;
        }
        
        const data = result.rows; 
        
        res.json({ data });
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

module.exports = {
    postOpenPosition,
    fetchAllPosition,
    applyJobProfile,
    fetchAllapplicant
 }