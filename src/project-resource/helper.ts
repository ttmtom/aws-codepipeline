export const getPipelineName = (projectName: string, pipelineName: string) => {
  return `fwd-${projectName}-${pipelineName}-pipeline`;
};
