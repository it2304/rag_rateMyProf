'use client'
import { useState } from "react";
import { Box, Stack, TextField, Button, Paper, Typography, Avatar, List, ListItem, ListItemText, CircularProgress, IconButton, useMediaQuery, Switch } from "@mui/material";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function Home() {
  const [messages, setMessages] = useState([
    {
      "role": "assistant",
      "content": "Hi! I am the rate my professor bot. How can I help you today?"
    }
  ]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const isMobile = useMediaQuery('(max-width:600px)');

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      background: {
        default: darkMode ? '#121212' : '#f0f0f0',
        paper: darkMode ? '#1e1e1e' : '#ffffff',
      },
      primary: {
        main: darkMode ? '#90caf9' : '#1976d2',
        light: darkMode ? '#4b5563' : '#e3f2fd',
      },
      secondary: {
        main: darkMode ? '#f48fb1' : '#dc004e',
        light: darkMode ? '#4a4a4a' : '#fce4ec',
      },
    },
  });

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    const newMessage = { role: "user", content: message };
    setMessages(prev => [...prev, newMessage]);
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([...messages, newMessage]),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';

      setMessages(prev => [...prev, { role: "assistant", content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiResponse += decoder.decode(value, { stream: true });
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: "assistant", content: aiResponse }
        ]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, there was an error processing your request." }]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const renderMessage = (message) => (
    <Box>
      <ReactMarkdown
        components={{
          code({node, inline, className, children, ...props}) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <SyntaxHighlighter
                style={tomorrow}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            )
          }
        }}
      >
        {message.content}
      </ReactMarkdown>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box 
        sx={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.default"
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">Rate My Professor Chat</Typography>
          <Switch checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
        </Box>
        <Paper 
          elevation={3}
          sx={{
            flexGrow: 1,
            width: isMobile ? "100%" : "90%",
            maxWidth: "600px",
            m: 'auto',
            display: "flex",
            flexDirection: "column",
            p: 2,
            overflow: "hidden",
            bgcolor: "background.paper"
          }}
        >
          <Box sx={{ flexGrow: 1, overflow: "auto", mb: 2 }}>
            {messages.map((message, index) => (
              <Box 
                key={index} 
                sx={{
                  display: "flex",
                  justifyContent: message.role === "assistant" ? "flex-start" : "flex-end",
                  mb: 2,
                }}
              >
                <Box sx={{ display: "flex", flexDirection: "row", alignItems: "flex-start", maxWidth: "80%" }}>
                  {message.role === "assistant" && (
                    <Avatar sx={{ bgcolor: "primary.main", mr: 1, mt: 1 }}>
                      <SmartToyIcon />
                    </Avatar>
                  )}
                  <Paper 
                    elevation={1}
                    sx={{
                      p: 2,
                      bgcolor: message.role === "assistant" ? "primary.light" : "secondary.light",
                      color: theme.palette.getContrastText(message.role === "assistant" ? theme.palette.primary.light : theme.palette.secondary.light),
                    }}
                  >
                    {renderMessage(message)}
                    <IconButton size="small" onClick={() => copyToClipboard(message.content)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Paper>
                  {message.role === "user" && (
                    <Avatar sx={{ bgcolor: "secondary.main", ml: 1, mt: 1 }}>
                      <PersonIcon />
                    </Avatar>
                  )}
                </Box>
              </Box>
            ))}
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            )}
          </Box>
          <Box component="form" onSubmit={(e) => { e.preventDefault(); sendMessage(); }} sx={{ display: "flex" }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              sx={{ mr: 1 }}
            />
            <Button 
              variant="contained" 
              endIcon={<SendIcon />}
              type="submit"
              disabled={loading}
            >
              Send
            </Button>
          </Box>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
