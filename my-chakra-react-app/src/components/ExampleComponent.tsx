import React from 'react';
import { Box, Button, Text } from '@chakra-ui/react';

const ExampleComponent: React.FC = () => {
    return (
        <Box p={4} borderWidth={1} borderRadius="lg" boxShadow="md">
            <Text fontSize="xl" mb={4}>
                This is an example component using Chakra UI!
            </Text>
            <Button colorScheme="teal">Click Me</Button>
        </Box>
    );
};

export default ExampleComponent;