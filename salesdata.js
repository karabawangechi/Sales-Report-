const salesDats = {
    2017: [
        { name: 'ADEMITA OKANA', chartUrl: '/images/charts/ademita_2017.png' },
        { name: 'AGENTS TEAM', chartUrl: '/images/charts/agents_2017.png' },
        // ... other salespersons
    ],
    2018: [
        { name: 'ADEMITA OKANA', chartUrl: '/images/charts/ademita_2018.png' },
        { name: 'AGENTS TEAM', chartUrl: '/images/charts/agents_2018.png' },
        // ... other salespersons
    ],
    // ... more years
};

router.get('/salesperson', (req, res) => {
    const year = req.query.year || new Date().getFullYear();
    const data = salesDats[year] || [];
    res.render('salesperson', { salesDats: data });
});

module.exports = router;