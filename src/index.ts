import express from "express";

const app = express();
const port = 8000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send("Hello World! to classroom API!");
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});