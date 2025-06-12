import React from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import theme from './theme';
import ExampleComponent from './components/ExampleComponent';

const App = () => {
  return (
    <ChakraProvider theme={theme}>
      <ExampleComponent />
    </ChakraProvider>
  );
};

export default App;