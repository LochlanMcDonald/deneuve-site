
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Welcome to Deneuve!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
