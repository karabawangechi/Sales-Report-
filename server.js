const express = require('express');
const sql = require('mssql');
const app = express();
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const MongoStore = require('connect-mongo');
const User = require('./models/user');
const cookieParser = require('cookie-parser');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');

const port = 3000;
const dbconfig = {
    server: '172.16.1.5',
    database: 'SysproCompanyA',
    user: 'syspro',
    password: 'syspro',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000,
            requestTimeout: 60000
        }
    }
};

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

const mongoUrl = 'mongodb://127.0.0.1:27017/kbcsales';
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected...'))
    .catch(err => {
        console.error('Error connecting to MongoDB:', err.message);
        process.exit(1);
    });

app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: 'mongodb://127.0.0.1:27017/kbcsales',
    })
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(
    new LocalStrategy({ emailField: 'email' }, (email, password, done) => {
        User.findOne({ email: email }, (err, user) => {
            if (err) return done(err);
            if (!user) return done(null, false, { message: 'Incorrect email.' });
            if (user.password !== password) return done(null, false, { message: 'Incorrect password.' });
            return done(null, user);
        });
    })
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user);
    });
});

const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
};

app.post('/register', async (req, res) => {
    try {
        const { fullname, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const users = await User.find({ password: { $exists: false } });

        for (const user of users) {
            user.password = await bcrypt.hash('defaultPassword', 10);
            await user.save();
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('index', { message: 'User already exists' });
        }


        const newUser = new User({
            fullname,
            email,
            password: hashedPassword,
        });

        const userData = await newUser.save();
        req.session.user = userData;
        
        res.render('login', { user: userData });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            console.error(`User not found with email: ${email}`);
            return res.status(401).send('User not found');
        }

        if (!user.password) {
            console.error(`User found but password is undefined for email: ${email}`);
            return res.status(500).send('Internal Server Error: User password is undefined');
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (isValidPassword) {
            req.session.user = {
                _id: user._id,
                email: user.email,
            };

            const topSalespersons = await getTopSalespersons();
            const topBrands = await getTopBrands();
            const topCustomers = await getTopCustomers();
            const totalBrands = await getTotalBrands();
            const totalSales = await getTotalSales();
            const totalSalespersons = await getTotalSalespersons();
            const totalCustomers = await getTotalCustomers();

            res.render('index', {
                topSalespersons,
                topBrands,
                topCustomers,
                totalBrands,
                totalSales,
                totalSalespersons,
                totalCustomers
            });
        } else {
            console.error(`Invalid password for email: ${email}`);
            res.status(401).send('Invalid password');
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Internal Server Error: ' + error.message);
    }
});

app.set('view engine', 'ejs');
app.use(express.static(path.join('public')));
app.use(express.static('public'));

app.get('/login', (req, res) => {
    res.render('login', {});
});
app.get('/signup', (req, res) => {
    res.render('signup', {});
});

app.get('/customer', async (req, res) => {
    try {
        const customerData = await getCustomerData();
        res.render('customer', { customerData }); // Render 'customer.ejs' with customerData
    } catch (error) {
        console.error('Error rendering customer page:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/register', (req, res) => {
    res.render('register', {});
});

app.get('/index', isAuthenticated, async (req, res) => {
    try {
        const topSalespersons = await getTopSalespersons();
        const topBrands = await getTopBrands();
        const topCustomers = await getTopCustomers();
        const totalBrands = await getTotalBrands();
        const totalSales = await getTotalSales();
        const totalSalespersons = await getTotalSalespersons();
        const totalCustomers = await getTotalCustomers();

        res.render('index', {
            topSalespersons,
            topBrands,
            topCustomers,
            totalBrands,
            totalSales,
            totalSalespersons,
            totalCustomers
        });
    } catch (error) {
        res.status(500).send('Error fetching data: ' + error.message);
    }
});

async function getTopSalespersons() {
    await sql.connect(dbconfig);
    const result = await sql.query(`
        SELECT TOP 10
            SalSalesperson.Name AS SalespersonName, 
            SUM(ArTrnDetail.NetSalesValue) AS TotalSales
        FROM 
            SysproCompanyA.dbo.ArTrnDetail ArTrnDetail
            INNER JOIN SysproCompanyA.dbo.SalSalesperson SalSalesperson 
                ON ArTrnDetail.Salesperson = SalSalesperson.Salesperson
        WHERE 
            ArTrnDetail.TrnYear=2024
        GROUP BY 
            SalSalesperson.Name
        ORDER BY 
            TotalSales DESC
    `);
    return result.recordset;
}

async function getTopBrands() {
    await sql.connect(dbconfig);
    const result = await sql.query(`
        SELECT TOP 10
            SalProductClassDes.Description AS BrandName, 
            SUM(ArTrnDetail.NetSalesValue) AS Revenue
        FROM 
            SysproCompanyA.dbo.ArTrnDetail ArTrnDetail
            INNER JOIN SysproCompanyA.dbo.SalProductClassDes SalProductClassDes 
                ON ArTrnDetail.ProductClass = SalProductClassDes.ProductClass
        WHERE 
            ArTrnDetail.TrnYear =2024
        GROUP BY 
            SalProductClassDes.Description
        ORDER BY 
            Revenue DESC
    `);
    return result.recordset;
}

async function getTopCustomers() {
    await sql.connect(dbconfig);
    const result = await sql.query(`
        SELECT TOP 10
            ArCustomer.Name AS CustomerName, 
            SUM(ArTrnDetail.NetSalesValue) AS Revenue
        FROM 
            SysproCompanyA.dbo.ArTrnDetail ArTrnDetail
            INNER JOIN SysproCompanyA.dbo.ArCustomer ArCustomer 
                ON ArTrnDetail.Customer = ArCustomer.Customer
        WHERE 
            ArTrnDetail.TrnYear =2024
        GROUP BY 
            ArCustomer.Name
        ORDER BY 
            Revenue DESC
    `);
    return result.recordset;
}

async function getTotalBrands() {
    await sql.connect(dbconfig);
    const result = await sql.query(`
        SELECT COUNT(DISTINCT ProductClass) AS Totalbrands
        FROM SysproCompanyA.dbo.SalSalespersonSum
    `);
    return result.recordset[0].TotalBrands;
}

async function getTotalSales() {
    await sql.connect(dbconfig);
    const result = await sql.query(`
        SELECT COUNT(*) AS TotalSales
        FROM SysproCompanyA.dbo.ArTrnDetail
    `);
    return result.recordset[0].TotalSales;
}

async function getTotalSalespersons() {
    await sql.connect(dbconfig);
    const result = await sql.query(`
        SELECT COUNT(DISTINCT Salesperson) AS TotalSalespersons
        FROM SysproCompanyA.dbo.SalSalesperson
    `);
    return result.recordset[0].TotalSalespersons;
}

async function getTotalCustomers() {
    await sql.connect(dbconfig);
    const result = await sql.query(`
        SELECT COUNT(DISTINCT Customer) AS TotalCustomers
        FROM SysproCompanyA.dbo.ArCustomer
    `);
    return result.recordset[0].TotalCustomers;
}
function getMonthName(month) {
    const monthNames = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
    return monthNames[month - 1];
}
app.get('/brandperformancedata', async (req, res) => {
    //const month= getMonthName(month);

    try {
        const brandPerformanceData = await getBrandPerformanceData();
        res.render('brandperformancedata', { brandPerformanceData: brandPerformanceData });
    } catch (error) {
        res.status(500).send('Error fetching brand performance data: ' + error.message);
    }

});

app.get('/brand', async (req, res) => {
    
    try {
        const brandPerformanceData = await getBrandPerformanceData();
        res.render('brand', { brandPerformanceData: JSON.stringify(brandPerformanceData) });
    } catch (error) {
        res.status(500).send('Error fetching brand performance data: ' + error.message);
    }
});
app.get('/filtered_sales', async (req, res) => {
    const { search, year } = req.query; // Assuming search and year are sent from client query parameters

    // Example: Extracting salespersonName and month from req.query or req.params
    const { salespersonName, month } = req.query; // Adjust as per your form data

    try {
        // Fetch sales data from your database using parameters
        const salesData = await getSalesData(salespersonName, month, year);

        if (!Array.isArray(salesData)) {
            throw new Error('Sales data is not an array');
        }

        // Filter sales data based on search and year (sample logic, replace with actual query logic)
        let filteredData = salesData.filter(salesperson => {
            let matchSearch = true;
            let matchYear = true;

            if (search && salesperson.name.toLowerCase().indexOf(search.toLowerCase()) === -1) {
                matchSearch = false;
            }

            if (year && !salesperson.labels.includes(year)) {
                matchYear = false;
            }

            return matchSearch && matchYear;
        });

        // Prepare data to send to the filtered_sales.html template
        const templateData = {
            salesData: filteredData // Pass filtered data to template
        };

        res.render('filtered_sales', templateData); // Render filtered_sales.html with data
    } catch (error) {
        console.error('Error fetching or processing data:', error);
        res.status(500).send('Error fetching or processing data'); // Handle error response
    }
});

app.get('/salesperson', async (req, res) => {
    const { year, search } = req.query;
    const salespersonName = req.query.salespersonName || null;
    const month = req.query.month || null;

    console.log('Request Parameters:', req.query);

    try {
        let salesData = await getSalesData(salespersonName, month, year);

        if (year) {
            salesData = salesData.filter(salesperson => salesperson.year === parseInt(year));
        }

        if (search) {
            salesData = salesData.filter(salesperson => salesperson.name.toLowerCase().includes(search.toLowerCase()));
        }

        const years = await getYears();

        console.log('Filtered Sales Data:', salesData);

        res.render('salesperson', { salesData, year, years });
    } catch (err) {
        console.error('Error fetching sales data:', err);
        res.status(500).send('Error fetching sales data');
    }
});
app.get('/salesperformancedata', async (req, res) => {
    try {
        const salesPerformanceData = await getSalesData();
        res.render('salesperformancedata', { salesPerformanceData: salesPerformanceData });
    } catch (error) {
        res.status(500).send('Error fetching sales performance data: ' + error.message);
    }
});

async function getBrandPerformanceData() {
    await sql.connect(dbconfig);

    // First query: Get monthly sales amount by brand
    const result = await sql.query(`
        SELECT 
            SalProductClassDes.Description AS BrandName, 
            ArTrnDetail.TrnMonth, 
            SUM(ArTrnDetail.NetSalesValue) AS SalesAmount
        FROM 
            SysproCompanyA.dbo.ArTrnDetail ArTrnDetail
            INNER JOIN SysproCompanyA.dbo.SalProductClassDes SalProductClassDes 
                ON ArTrnDetail.ProductClass = SalProductClassDes.ProductClass
        WHERE 
            ArTrnDetail.TrnYear = 2024
        GROUP BY 
            SalProductClassDes.Description, 
            ArTrnDetail.TrnMonth
        ORDER BY 
            SalProductClassDes.Description, 
            ArTrnDetail.TrnMonth
    `);

    const brandPerformanceData = {};

    result.recordset.forEach(row => {
        if (!brandPerformanceData[row.BrandName]) {
            brandPerformanceData[row.BrandName] = { name: row.BrandName, labels: [], data: [] };
        }
        brandPerformanceData[row.BrandName].labels.push(`Month ${row.TrnMonth}`);
        brandPerformanceData[row.BrandName].data.push(Math.round(row.SalesAmount));
    });

    // Second query: Get sales amount by brand and salesperson
    const salespersonResult = await sql.query(`
        SELECT 
            SalProductClassDes.Description AS BrandName, 
            SalSalesperson.Name AS SalespersonName, 
            SUM(ArTrnDetail.NetSalesValue) AS SalesAmount
        FROM 
            SysproCompanyA.dbo.ArTrnDetail ArTrnDetail
            INNER JOIN SysproCompanyA.dbo.SalProductClassDes SalProductClassDes 
                ON ArTrnDetail.ProductClass = SalProductClassDes.ProductClass
            INNER JOIN SysproCompanyA.dbo.SalSalesperson SalSalesperson 
                ON ArTrnDetail.Salesperson = SalSalesperson.Salesperson
        WHERE 
            ArTrnDetail.TrnYear=2024
            
        GROUP BY 
            SalProductClassDes.Description, 
            SalSalesperson.Name
        ORDER BY 
            SalProductClassDes.Description, 
            SalSalesperson.Name
    `);

    salespersonResult.recordset.forEach(row => {
        if (!brandPerformanceData[row.BrandName]) {
            brandPerformanceData[row.BrandName] = { name: row.BrandName, labels: [], data: [], salespersonLabels: [], salespersonData: [] };
        }
        if (!brandPerformanceData[row.BrandName].salespersonLabels) {
            brandPerformanceData[row.BrandName].salespersonLabels = [];
            brandPerformanceData[row.BrandName].salespersonData = [];
        }
        brandPerformanceData[row.BrandName].salespersonLabels.push(row.SalespersonName);
        brandPerformanceData[row.BrandName].salespersonData.push(Math.round(row.SalesAmount));
    });

    return Object.values(brandPerformanceData);
}
async function getCustomerData() {
    try {
        await sql.connect(dbconfig); // Connect to the database using dbconfig
        const result = await sql.query(`
        SELECT 
            ArCustomer.Name AS CustomerName, 
            ArTrnDetail.TrnMonth,
            SUM(ArTrnDetail.NetSalesValue) AS Revenue
        FROM 
            SysproCompanyA.dbo.ArTrnDetail ArTrnDetail
            INNER JOIN SysproCompanyA.dbo.ArCustomer ArCustomer 
                ON ArTrnDetail.Customer = ArCustomer.Customer
        WHERE 
            (ArTrnDetail.TrnYear = 2023 AND ArTrnDetail.TrnMonth >= 7) 
            OR (ArTrnDetail.TrnYear = 2024 AND ArTrnDetail.TrnMonth <= 6)
        GROUP BY 
            ArCustomer.Name, ArTrnDetail.TrnMonth
        ORDER BY 
            ArCustomer.Name, ArTrnDetail.TrnMonth;
        `);

        const monthNames = [
             'July',  'August',  'September',  'October',  'November',  'December',
             'January',  'February',  'March',  'April',  'May',  'June'
        ];

        const customerData = [];
        const customerMap = {};

        result.recordset.forEach(row => {
            if (!customerMap[row.CustomerName]) {
                customerMap[row.CustomerName] = {
                    name: row.CustomerName,
                    labels: [],
                    data: []
                };
                customerData.push(customerMap[row.CustomerName]);
            }

            customerMap[row.CustomerName].labels.push(monthNames[row.TrnMonth]);
            customerMap[row.CustomerName].data.push(Math.round(row.Revenue)); // Round the revenue values
        });

        return customerData;
    } catch (err) {
        console.error('Error fetching customer data:', err);
        throw err; // Propagate the error upwards
    } finally {
        await sql.close(); // Close the database connection
    }
}
async function getSalesData(salespersonName, month, year) {
    await sql.connect(dbconfig);

    let whereClause = `WHERE ArTrnDetail.TrnYear = ${year || new Date().getFullYear()}`;
    
    if (salespersonName) {
        whereClause += ` AND SalSalesperson.Name LIKE '%${salespersonName}%'`;
    }
    
    if (month) {
        whereClause += ` AND ArTrnDetail.TrnMonth = ${month}`;
    }
    
    let query = `
        SELECT 
            SalSalesperson.Name AS SalespersonName, 
            ArTrnDetail.TrnMonth, 
            SUM(ArTrnDetail.NetSalesValue) AS SalesAmount,
            SalProductClassDes.Description AS BrandName
        FROM 
            SysproCompanyA.dbo.ArTrnDetail ArTrnDetail
            INNER JOIN SysproCompanyA.dbo.SalSalesperson SalSalesperson 
                ON ArTrnDetail.Salesperson = SalSalesperson.Salesperson
            INNER JOIN SysproCompanyA.dbo.SalProductClassDes SalProductClassDes
                ON ArTrnDetail.ProductClass = SalProductClassDes.ProductClass
        ${whereClause}
        GROUP BY 
            SalSalesperson.Name, 
            ArTrnDetail.TrnMonth,
            SalProductClassDes.Description
        ORDER BY 
            ArTrnDetail.TrnMonth,
            SalSalesperson.Name`;

    const result = await sql.query(query);
    console.log('Query Result:', result.recordset);
    const monthNames = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
    const salesData = [];
    const dataMap = {};

    result.recordset.forEach(row => {
        if (!dataMap[row.SalespersonName]) {
            dataMap[row.SalespersonName] = { 
                name: row.SalespersonName, 
                labels: [], 
                data: [], 
                brands: {}, 
                brandLabels: [], 
                brandData: [] 
            };
            salesData.push(dataMap[row.SalespersonName]);
        }
        dataMap[row.SalespersonName].labels.push(monthNames[row.TrnMonth - 1]);
        dataMap[row.SalespersonName].data.push(Math.round(row.SalesAmount)); // Round off the sales amount

        if (!dataMap[row.SalespersonName].brands[row.BrandName]) {
            dataMap[row.SalespersonName].brands[row.BrandName] = 0;
        }
        dataMap[row.SalespersonName].brands[row.BrandName] += Math.round(row.SalesAmount); // Round off the sales amount
    });

    salesData.forEach(salesperson => {
        Object.entries(salesperson.brands).forEach(([brand, amount]) => {
            salesperson.brandLabels.push(brand);
            salesperson.brandData.push(amount);
        });
    });

    return salesData;
}

app.get('/years', async (req, res) => {
    try {
        const years = await getYears();
        res.json({ years });
    } catch (err) {
        res.status(500).send('Error fetching years: ' + err.message);
    }
});

async function getYears() {
    await sql.connect(dbconfig);
    const query = `SELECT DISTINCT TrnYear FROM ArTrnDetail ORDER BY TrnYear DESC`;
    const result = await sql.query(query);
    const years = result.recordset.map(row => row.TrnYear);
    return years;
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
