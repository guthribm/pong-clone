import "./App.css";
import Card from "@mui/material/Card";
import type { ElementType } from "react";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import { Link as RouterLink } from "react-router-dom";

function GameTile({
  title,
  to,
  disabled = false,
}: {
  title: string;
  to?: string;
  disabled?: boolean;
}) {
  return (
    <Card
      sx={{
        height: 160,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <CardContent>
        <Typography variant="h6">{title}</Typography>
      </CardContent>
      <CardActions sx={{ p: 2 }}>
        <Box sx={{ flex: 1 }} />
        {to ? (
          <Button
            variant="contained"
            component={RouterLink as unknown as ElementType}
            to={to}
            disabled={disabled}
          >
            Play
          </Button>
        ) : (
          <Button variant="contained" disabled>
            Coming soon
          </Button>
        )}
      </CardActions>
    </Card>
  );
}

export default function App() {
  return (
    <Box sx={{ minHeight: "100vh", p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Game Suite
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: {
            xs: "repeat(1, minmax(0, 1fr))",
            sm: "repeat(2, minmax(0, 1fr))",
            md: "repeat(3, minmax(0, 1fr))",
          },
        }}
      >
        <GameTile title="Pong" to="/pong" />

        <GameTile title="Breakout" to="/breakout" />

        <GameTile title="Snake" disabled />

        <GameTile title="Tetris" to="/tetris" />

        <GameTile title="Space Invaders" disabled />

        <GameTile title="More coming..." disabled />
      </Box>
    </Box>
  );
}
