const express = require(`express`);


const app = express();

const PORT = process.env.PORT || 3000;


// local external files
app.use(express.static('public'));

// Starts the server to begin listening
// =============================================================
const server = app.listen(PORT, function() {
  console.log("App listening on PORT " + PORT);
});
